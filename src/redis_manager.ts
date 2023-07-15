/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ApplicationService, EmitterService } from '@adonisjs/core/types'
import RedisConnection from './redis_connection.js'
import { pubsubMethods } from './pubsub_methods.js'
import { ioMethods } from './io_methods.js'
import {
  Connection,
  GetConnectionType,
  RedisConnectionAugmented,
  RedisConnectionsList,
  RedisManagerFactory,
} from './types/main.js'
import RedisClusterConnection from './redis_cluster_connection.js'

export class RawRedisManager<ConnectionList extends RedisConnectionsList> {
  /**
   * User provided config
   */
  #config: {
    connection: keyof ConnectionList
    connections: ConnectionList
  }

  /**
   * Reference to the application
   */
  #app: ApplicationService

  /**
   * Reference to the emitter
   */
  #emitter: EmitterService

  /**
   * An array of connections with health checks enabled, which means, we always
   * create a connection for them, even when they are not used.
   */
  #healthCheckConnections: string[] = []

  /**
   * A copy of live connections. We avoid re-creating a new connection
   * everytime and re-use connections.
   */
  activeConnections: {
    [K in keyof ConnectionList]?: GetConnectionType<ConnectionList, K>
  } = {}

  /**
   * A boolean to know whether health checks have been enabled on one
   * or more redis connections or not.
   */
  get healthChecksEnabled() {
    return this.#healthCheckConnections.length > 0
  }

  /**
   * Returns the length of active connections
   */
  get activeConnectionsCount() {
    return Object.keys(this.activeConnections).length
  }

  constructor(
    app: ApplicationService,
    config: {
      connection: keyof ConnectionList
      connections: ConnectionList
    },
    emitter: EmitterService
  ) {
    this.#app = app
    this.#config = config
    this.#emitter = emitter
    this.#healthCheckConnections = Object.keys(this.#config.connections).filter(
      (connection) => this.#config.connections[connection].healthCheck
    )
  }

  /**
   * Returns the default connection name
   */
  #getDefaultConnection(): keyof ConnectionList {
    return this.#config.connection
  }

  /**
   * Returns an existing connection using it's name or the
   * default connection,
   */
  #getExistingConnection(name?: keyof ConnectionList) {
    name = name || this.#getDefaultConnection()
    return this.activeConnections[name]
  }

  /**
   * Returns config for a given connection
   */
  #getConnectionConfig<ConnectionName extends keyof ConnectionList>(name: ConnectionName) {
    return this.#config.connections[name]
  }

  /**
   * Forward events to the application event emitter
   * for a given connection
   */
  #forwardConnectionEvents(connection: Connection) {
    connection.on('ready', () => {
      this.#emitter.emit('redis:ready', { connection })
    })
    connection.on('ready', ($connection) =>
      this.#emitter.emit('redis:ready', { connection: $connection })
    )
    connection.on('connect', ($connection) =>
      this.#emitter.emit('redis:connect', { connection: $connection })
    )
    connection.on('error', (error, $connection) =>
      this.#emitter.emit('redis:error', { error, connection: $connection })
    )
    connection.on('node:added', ($connection, node) =>
      this.#emitter.emit('redis:node:added', { node, connection: $connection })
    )
    connection.on('node:removed', (node, $connection) =>
      this.#emitter.emit('redis:node:removed', { node, connection: $connection })
    )
    connection.on('node:error', (error, address, $connection) =>
      this.#emitter.emit('redis:node:error', { error, address, connection: $connection })
    )

    /**
     * Stop tracking the connection after it's removed
     */
    connection.on('end', ($connection) => {
      delete this.activeConnections[$connection.connectionName]
      this.#emitter.emit('redis:end', { connection: $connection })
    })
  }

  /**
   * Returns redis factory for a given named connection
   */
  connection<ConnectionName extends keyof ConnectionList>(
    connectionName?: ConnectionName
  ): GetConnectionType<ConnectionList, ConnectionName> {
    const name = connectionName || this.#getDefaultConnection()

    /**
     * Return existing connection if already exists
     */
    if (this.activeConnections[name]) {
      return this.activeConnections[name] as any
    }

    /**
     * Get config for the named connection
     */
    const config = this.#getConnectionConfig(name)
    if (!config) {
      throw new Error(`Redis connection "${name.toString()}" is not defined`)
    }

    /**
     * Instantiate the connection based upon the config
     */
    const connection =
      'clusters' in config
        ? new RedisClusterConnection(name as string, config, this.#app)
        : new RedisConnection(name as string, config, this.#app)

    /**
     * Cache the connection so that we can re-use it later
     */
    this.activeConnections[name] = connection as GetConnectionType<ConnectionList, ConnectionName>

    /**
     * Forward ioredis events to the application event emitter
     */
    this.#forwardConnectionEvents(connection)

    return connection as GetConnectionType<ConnectionList, ConnectionName>
  }

  /**
   * Quit a named connection or the default connection when no
   * name is defined.
   */
  async quit<ConnectionName extends keyof ConnectionList>(name?: ConnectionName) {
    const connection = this.#getExistingConnection(name)
    if (!connection) {
      return
    }

    return connection.quit()
  }

  /**
   * Disconnect a named connection or the default connection when no
   * name is defined.
   */
  async disconnect<ConnectionName extends keyof ConnectionList>(name?: ConnectionName) {
    const connection = this.#getExistingConnection(name)
    if (!connection) {
      return
    }

    return connection.disconnect()
  }

  /**
   * Quit all connections
   */
  async quitAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.disconnect(name)))
  }

  /**
   * Returns the report for all connections marked for `healthChecks`
   */
  async report() {
    const reports = await Promise.all(
      this.#healthCheckConnections.map((connection) => this.connection(connection).getReport(true))
    )

    const healthy = !reports.find((report) => !!report.error)
    return {
      displayName: 'Redis',
      health: {
        healthy,
        message: healthy
          ? 'All connections are healthy'
          : 'One or more redis connections are not healthy',
      },
      meta: reports,
    }
  }

  /**
   * Define a custom command using LUA script. You can run the
   * registered command using the "runCommand" method.
   */
  defineCommand(...args: Parameters<RedisConnectionAugmented['defineCommand']>): this {
    this.connection().defineCommand(...args)
    return this
  }

  /**
   * Run a pre registered command
   */
  runCommand(command: string, ...args: any[]): any {
    return this.connection().runCommand(command, ...args)
  }
}

/**
 * Here we attach pubsub and ioRedis methods to the class.
 *
 * But we also need to inform typescript about the existence of
 * these methods. So we are exporting the class with a
 * casted type that has these methods.
 */
const RedisManager = RawRedisManager as unknown as RedisManagerFactory

pubsubMethods.forEach((method) => {
  RedisManager.prototype[method] = function redisManagerProxyFn(...args: any[]) {
    return this.connection()[method](...args)
  }
})

ioMethods.forEach((method) => {
  RedisManager.prototype[method] = function redisManagerProxyFn(...args: any[]) {
    return this.connection()[method](...args)
  }
})

export default RedisManager
