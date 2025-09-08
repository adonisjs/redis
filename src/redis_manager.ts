/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'
import type { Logger } from '@adonisjs/core/logger'
import { RuntimeException } from '@poppinss/utils/exception'
import { type ClusterOptions, type RedisOptions, Redis } from 'ioredis'

import debug from './debug.ts'
import { baseMethods } from './connections/io_methods.ts'
import RedisConnection from './connections/redis_connection.ts'
import RedisClusterConnection from './connections/redis_cluster_connection.ts'
import type {
  GetConnectionType,
  IORedisBaseCommands,
  PubSubChannelHandler,
  PubSubPatternHandler,
  RedisConnectionsList,
} from './types.ts'

/**
 * Redis Manager exposes the API to manage multiple redis connections
 * based upon user defined config.
 *
 * All connections are long-lived until they are closed explictly
 *
 * @example
 * ```ts
 * const redis = new RedisManager({
 *   connection: 'main',
 *   connections: {
 *     main: {
 *       host: 'localhost',
 *       port: 6379
 *     }
 *   }
 * }, logger)
 *
 * const connection = redis.connection('main')
 * await connection.set('key', 'value')
 * ```
 */
class RedisManager<ConnectionsList extends RedisConnectionsList> extends Emittery<{
  connection: RedisConnection | RedisClusterConnection
}> {
  /**
   * Lua scripts to apply to all the connections
   */
  #scripts: Record<
    string,
    {
      lua: string
      numberOfKeys?: number
      readOnly?: boolean
    }
  > = {}

  /**
   * Logger instance for error reporting
   */
  #logger: Logger

  /**
   * Should we log redis errors or not
   */
  #shouldLogRedisErrors: boolean = true

  /**
   * The default error reporter we use to log redis errors
   */
  #errorReporter = function logRedisError(
    this: RedisManager<ConnectionsList>,
    data: { error: any }
  ) {
    this.#logger.fatal({ err: data.error }, 'Redis connection failure')
  }.bind(this)

  /**
   * Reference to "import('ioredis').Redis.Command"
   */
  Command = Redis.Command

  /**
   * A copy of live connections. We avoid re-creating a new connection
   * everytime and re-use connections.
   */
  activeConnections: {
    [K in keyof ConnectionsList]?: GetConnectionType<ConnectionsList, K>
  } = {}

  /**
   * Returns the length of active connections
   */
  get activeConnectionsCount() {
    return Object.keys(this.activeConnections).length
  }

  /**
   * Create a new RedisManager instance
   *
   * @param managerConfig - Configuration for connections
   * @param logger - Logger instance for error reporting
   *
   * @example
   * ```ts
   * const manager = new RedisManager({
   *   connection: 'main',
   *   connections: {
   *     main: { host: 'localhost', port: 6379 }
   *   }
   * }, logger)
   * ```
   */
  constructor(
    public managerConfig: { connection: keyof ConnectionsList; connections: ConnectionsList },
    logger: Logger
  ) {
    super()
    this.#logger = logger
  }

  /**
   * Merging manager scripts with the connection config
   *
   * @param config - Connection configuration
   */
  #mergeScripts<Config extends ClusterOptions | RedisOptions>(config: Config): Config {
    config.scripts = Object.assign({}, config.scripts, this.#scripts)
    return config
  }

  /**
   * Disable error logging of redis connection errors. You must
   * handle the errors manually, otheriwse the app will crash
   *
   * @example
   * ```ts
   * redis.doNotLogErrors()
   * redis.connection().on('error', (error) => {
   *   // Handle error manually
   * })
   * ```
   */
  doNotLogErrors() {
    this.#shouldLogRedisErrors = false
    Object.keys(this.activeConnections).forEach((name) => {
      debug('removing error reporter from %s connection', name)
      this.activeConnections[name]?.off('error', this.#errorReporter)
    })
    return this
  }

  /**
   * Returns redis factory for a given named connection
   *
   * @param connectionName - Optional connection name, defaults to default connection
   *
   * @example
   * ```ts
   * const connection = redis.connection('cache')
   * await connection.set('key', 'value')
   * ```
   */
  connection<ConnectionName extends keyof ConnectionsList>(
    connectionName?: ConnectionName
  ): GetConnectionType<ConnectionsList, ConnectionName> {
    const name = connectionName || this.managerConfig.connection
    debug('resolving connection %s', name)

    /**
     * Return existing connection if already exists
     */
    if (this.activeConnections[name]) {
      debug('reusing existing connection %s', name)
      return this.activeConnections[name] as GetConnectionType<ConnectionsList, ConnectionName>
    }

    /**
     * Get config for the named connection
     */
    const config = this.managerConfig.connections[name]
    if (!config) {
      throw new RuntimeException(`Redis connection "${name.toString()}" is not defined`)
    }

    /**
     * Instantiate the connection based upon the config
     */
    debug('creating new connection %s', name)
    const connection =
      'clusters' in config
        ? new RedisClusterConnection(
            name as string,
            config.clusters,
            this.#mergeScripts(config.clusterOptions || {})
          )
        : new RedisConnection(name as string, this.#mergeScripts(config))

    /**
     * Notify about a new connection
     */
    this.emit('connection', connection)

    /**
     * Log errors when not disabled by the user
     */
    if (this.#shouldLogRedisErrors) {
      debug('attaching error reporter to log connection errors')
      connection.on('error', this.#errorReporter)
      connection.on('subscriber:error', this.#errorReporter)
    }

    /**
     * Remove connection from the list of tracked connections
     */
    connection.on('end', ({ connection: $connection }) => {
      debug('%s connection closed. Removing from tracked connections list', name)
      delete this.activeConnections[$connection.connectionName]
    })

    /**
     * Cache the connection so that we can re-use it later
     */
    this.activeConnections[name] = connection as GetConnectionType<ConnectionsList, ConnectionName>
    return connection as GetConnectionType<ConnectionsList, ConnectionName>
  }

  /**
   * Subscribe to a given channel to receive Redis pub/sub events. A
   * new subscriber connection will be created/managed automatically.
   *
   * @param channel - The channel name to subscribe to
   * @param handler - Function to handle received messages
   *
   * @example
   * ```ts
   * redis.subscribe('notifications', (message) => {
   *   console.log('Received:', message)
   * })
   * ```
   */
  subscribe(channel: string, handler: PubSubChannelHandler): void {
    return this.connection().subscribe(channel, handler)
  }

  /**
   * Unsubscribe from a channel
   *
   * @param channel - The channel name to unsubscribe from
   *
   * @example
   * ```ts
   * await redis.unsubscribe('notifications')
   * ```
   */
  unsubscribe(channel: string) {
    return this.connection().unsubscribe(channel)
  }

  /**
   * Make redis subscription for a pattern
   *
   * @param pattern - The pattern to subscribe to
   * @param handler - Function to handle received pattern messages
   *
   * @example
   * ```ts
   * redis.psubscribe('news.*', (channel, message) => {
   *   console.log(`Channel ${channel}:`, message)
   * })
   * ```
   */
  psubscribe(pattern: string, handler: PubSubPatternHandler): void {
    return this.connection().psubscribe(pattern, handler)
  }

  /**
   * Unsubscribe from a given pattern
   *
   * @param pattern - The pattern to unsubscribe from
   *
   * @example
   * ```ts
   * await redis.punsubscribe('news.*')
   * ```
   */
  punsubscribe(pattern: string) {
    return this.connection().punsubscribe(pattern)
  }

  /**
   * Publish the pub/sub message
   *
   * @param channel - The channel to publish to
   * @param message - The message to publish
   * @param callback - Optional callback for completion
   *
   * @example
   * ```ts
   * // Promise-based
   * const count = await redis.publish('notifications', 'Hello World')
   *
   * // Callback-based
   * redis.publish('notifications', 'Hello World', (err, count) => {
   *   console.log('Published to', count, 'subscribers')
   * })
   * ```
   */
  publish(
    channel: string,
    message: string,
    callback: (error: Error | null | undefined, count: number | undefined) => void
  ): void
  publish(channel: string, message: string): Promise<number>
  publish(
    channel: string,
    message: string,
    callback?: (error: Error | null | undefined, count: number | undefined) => void
  ) {
    return callback
      ? this.connection().publish(channel, message, callback)
      : this.connection().publish(channel, message)
  }

  /**
   * Define a custom command using LUA script. You can run the
   * registered command using the "runCommand" method.
   *
   * @param name - The name of the command
   * @param definition - Command definition with lua script
   *
   * @example
   * ```ts
   * redis.defineCommand('incrementBy', {
   *   lua: 'return redis.call("incrby", KEYS[1], ARGV[1])',
   *   numberOfKeys: 1
   * })
   * ```
   */
  defineCommand(
    name: string,
    definition: {
      lua: string
      numberOfKeys?: number
      readOnly?: boolean
    }
  ): this {
    /**
     * Apply command on existing connections
     */
    Object.keys(this.activeConnections).forEach((connectionName) => {
      this.activeConnections[connectionName]?.defineCommand(name, definition)
    })

    /**
     * Store reference to scripts for new commands
     */
    this.#scripts[name] = definition
    return this
  }

  /**
   * Run a pre registered command on the default command
   *
   * @param command - The name of the registered command
   * @param args - Arguments to pass to the command
   *
   * @example
   * ```ts
   * const result = await redis.runCommand('incrementBy', 'key1', 5)
   * ```
   */
  runCommand(command: string, ...args: any[]): any {
    return this.connection().runCommand(command, ...args)
  }

  /**
   * Quit a named connection or the default connection when no
   * name is defined.
   *
   * @param name - Optional connection name to quit
   *
   * @example
   * ```ts
   * await redis.quit('cache')
   * await redis.quit() // quits default connection
   * ```
   */
  async quit<ConnectionName extends keyof ConnectionsList>(name?: ConnectionName) {
    const connection = this.activeConnections[name || this.managerConfig.connection]
    if (!connection) {
      return
    }

    return connection.quit()
  }

  /**
   * Disconnect a named connection or the default connection when no
   * name is defined.
   *
   * @param name - Optional connection name to disconnect
   *
   * @example
   * ```ts
   * await redis.disconnect('cache')
   * await redis.disconnect() // disconnects default connection
   * ```
   */
  async disconnect<ConnectionName extends keyof ConnectionsList>(name?: ConnectionName) {
    const connection = this.activeConnections[name || this.managerConfig.connection]
    if (!connection) {
      return
    }

    return connection.disconnect()
  }

  /**
   * Quit all connections
   *
   * @example
   * ```ts
   * await redis.quitAll()
   * ```
   */
  async quitAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   *
   * @example
   * ```ts
   * await redis.disconnectAll()
   * ```
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.disconnect(name)))
  }
}

interface RedisManager<ConnectionsList extends RedisConnectionsList> extends IORedisBaseCommands {}
baseMethods.forEach((method) => {
  ;(RedisManager.prototype as any)[method] = function redisConnectionProxyFn(...args: any[]) {
    return this.connection()[method](...args)
  }
})

export default RedisManager
