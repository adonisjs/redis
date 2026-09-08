/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'
import { RuntimeException } from '@poppinss/utils/exception'
import type { RedisClientOptions, RedisClientType } from 'redis'

import debug from '../debug.ts'
import { nodeRedisMethods } from './node_redis_methods.ts'
import type {
  ConnectionEvents,
  NodeRedisCommands,
  NodeRedisConnectionConfig,
  NodeRedisConnectionStatus,
} from '../types.ts'

/**
 * NodeRedisConnection exposes the API to run Redis commands using the
 * official "redis" (node-redis) client.
 *
 * ## Why this class does not extend "AbstractConnection"
 *
 * "AbstractConnection" is written against the ioredis client. Every
 * accessor on it (status, autoPipelineQueueSize, quitIoConnection, and
 * so on) reads from "this.ioConnection". Making it generic enough to
 * host both clients would mean rewriting the class the existing
 * connections rely on, and this prototype must leave the ioredis
 * code path untouched. So this connection is a sibling
 * implementation that speaks the same public dialect
 * (status, isReady, events, quit, disconnect).
 *
 * ## The async connect problem
 *
 * node-redis requires an awaited "connect()" call before any command
 * can be issued, but "redis.connection()" resolves synchronously
 * inside the IoC container, and constructors cannot be async.
 *
 * The answer used here: the connection object is a synchronously
 * created handle. The client itself is created and connected inside
 * a single memoized promise, and every command awaits that promise
 * before running. The first command pays the connection cost, and
 * every later one hits an already resolved promise.
 *
 * @example
 * ```ts
 * const connection = new NodeRedisConnection('main', {
 *   client: 'node-redis',
 *   socket: { host: 'localhost', port: 6379 },
 * })
 *
 * // No connect() call needed, the command awaits it internally
 * await connection.set('key', 'value')
 * const value = await connection.get('key')
 * ```
 */
export class NodeRedisConnection extends Emittery<ConnectionEvents<NodeRedisConnection>> {
  /**
   * Normalized node-redis client options
   */
  #config: RedisClientOptions

  /**
   * Reference to the underlying node-redis client. It stays undefined
   * until the connection has been established at-least once.
   */
  #client?: RedisClientType

  /**
   * The memoized "connect" promise. This is the crux of this class: it
   * is created on the first command (or on an explicit "connect" call)
   * and re-used by every subsequent command.
   */
  #connection?: Promise<RedisClientType>

  /**
   * Connection status. We track it by hand (from the client events) and
   * re-use the ioredis vocabulary, so that code duck-typing on
   * "connection.status" keeps working.
   */
  #status: NodeRedisConnectionStatus = 'wait'

  /**
   * Set to true after an explicit "quit" or "disconnect" call. Reviving
   * the connection after that point would silently dial the server
   * again, so we throw instead.
   */
  #ended: boolean = false

  /**
   * Lua scripts registered via "defineCommand" and executed by
   * "runCommand"
   */
  #scripts: Record<string, { lua?: string; numberOfKeys?: number; readOnly?: boolean }> = {}

  /**
   * The last error emitted by the "error" event. We set it to null after
   * the "ready" event
   */
  lastError?: any

  /**
   * Returns status of the main connection
   */
  get status(): NodeRedisConnectionStatus {
    return this.#status
  }

  /**
   * Reference to the underlying node-redis client. This is the
   * node-redis counterpart of ".ioConnection".
   *
   * It is undefined until the connection has been established, since
   * the client is created lazily (see the class docblock). Use
   * "await connection.connect()" to get a guaranteed client.
   */
  get nodeConnection(): RedisClientType | undefined {
    return this.#client
  }

  /**
   * Create a new node-redis connection
   *
   * @param connectionName - Unique name for this connection
   * @param config - node-redis client options
   */
  constructor(
    public connectionName: string,
    config: NodeRedisConnectionConfig
  ) {
    debug('creating node-redis connection %s: %O', connectionName, config)
    super()
    this.#config = this.#normalizeConfig(config)
  }

  /**
   * Normalizes the config to be compatible with node-redis. We strip the
   * "client" discriminant and unwrap the AdonisJS "Secret" values, so
   * that the config file can look like the ioredis one.
   */
  #normalizeConfig(config: NodeRedisConnectionConfig): RedisClientOptions {
    const { client, ...rest } = config
    const normalized = { ...rest } as RedisClientOptions

    if (normalized.password && typeof normalized.password !== 'string') {
      normalized.password = (normalized.password as any).release()
    }

    return normalized
  }

  /**
   * Imports the node-redis client. "redis" is an optional peer dependency,
   * so we import it lazily and turn the module resolution error into an
   * actionable message.
   */
  static async #importClient() {
    try {
      const { createClient } = await import('redis')
      return createClient
    } catch (error) {
      throw new RuntimeException(
        'Cannot find the "redis" package. It must be installed to use node-redis backed connections',
        { cause: error }
      )
    }
  }

  /**
   * Monitoring the redis client via its event emitter to cleanup things
   * properly and also notify subscribers of this class.
   */
  #monitorConnection(client: RedisClientType) {
    client.on('connect', () => {
      this.#status = 'connect'
      this.emit('connect', { connection: this })
    })

    client.on('ready', () => {
      /**
       * We must set the error to null when server is ready to accept
       * commands
       */
      this.lastError = null
      this.#status = 'ready'
      this.emit('ready', { connection: this })
    })

    client.on('error', (error: any) => {
      this.lastError = error
      this.emit('error', { error, connection: this })
    })

    /**
     * node-redis does not share the retry delay with the "reconnecting"
     * event, hence "waitTime" is always zero here.
     */
    client.on('reconnecting', () => {
      this.#status = 'reconnecting'
      this.emit('reconnecting', { connection: this, waitTime: 0 })
    })

    /**
     * On end, we must cleanup the client and self listeners
     */
    client.on('end', () => {
      this.#status = 'end'
      this.#client = undefined
      this.#connection = undefined

      client.removeAllListeners()
      this.emit('end', { connection: this }).finally(() => {
        this.clearListeners(['connect', 'ready', 'error', 'reconnecting', 'end'])
      })
    })
  }

  /**
   * Establishes the connection (once) and returns the underlying
   * node-redis client.
   *
   * Calling this method multiple times is safe: the promise is memoized
   * and shared by every caller. You usually do not have to call it, as
   * every command method awaits it internally.
   *
   * @example
   * ```ts
   * const client = await redis.connection('main').connect()
   * await client.set('key', 'value', { PX: 1000 })
   * ```
   */
  connect(): Promise<RedisClientType> {
    if (this.#ended) {
      return Promise.reject(
        new RuntimeException(
          `Cannot use the "${this.connectionName}" connection after it has been closed`
        )
      )
    }

    if (this.#connection) {
      return this.#connection
    }

    debug('connecting node-redis connection %s', this.connectionName)
    this.#status = 'connecting'

    this.#connection = (async () => {
      /**
       * The import is lazy on purpose. "redis" is an optional peer
       * dependency, so the module must never be loaded for apps that
       * only use ioredis connections.
       */
      const createClient = await NodeRedisConnection.#importClient()

      const client = createClient(this.#config) as unknown as RedisClientType
      this.#client = client
      this.#monitorConnection(client)

      await client.connect()
      return client
    })().catch((error) => {
      /**
       * Reset the memoized promise, so that a later command can retry
       * instead of re-throwing the same error forever.
       */
      this.#connection = undefined
      this.#status = 'close'

      const client = this.#client
      this.#client = undefined
      if (client) {
        client.removeAllListeners()
      }

      throw error
    })

    return this.#connection
  }

  /**
   * Returns a boolean notifying if the connection is in connecting state
   */
  isConnecting() {
    return this.#status === 'connecting' || this.#status === 'reconnecting'
  }

  /**
   * Returns a boolean notifying if the connection is in ready state
   */
  isReady() {
    return this.#status === 'ready' || this.#status === 'connect'
  }

  /**
   * Returns a boolean notifying if the connection has been closed
   */
  isClosed() {
    return this.#status === 'end' || this.#status === 'close'
  }

  /**
   * Gracefully end the redis connection. Pending commands are flushed
   * before the socket is closed.
   */
  async quit() {
    return this.#endConnection(true)
  }

  /**
   * Forcefully end the redis connection
   */
  async disconnect() {
    return this.#endConnection(false)
  }

  /**
   * Shared implementation for "quit" and "disconnect".
   */
  async #endConnection(graceful: boolean) {
    this.#ended = true

    const client = this.#client
    this.#connection = undefined

    /**
     * A connection that has never dialed the server has nothing to quit.
     * node-redis throws a "ClientClosedError" when closing a client that
     * was never opened, so we emit the "end" event by hand to keep the
     * manager bookkeeping in sync.
     */
    if (!client || !client.isOpen) {
      this.#status = 'end'
      this.#client = undefined
      client?.removeAllListeners()
      await this.emit('end', { connection: this })
      return
    }

    if (graceful) {
      await client.close()
      return
    }

    client.destroy()
  }

  /**
   * Publish a pub/sub message.
   *
   * Note: subscribing is not implemented in this prototype (node-redis
   * needs a dedicated client for it), but publishing works on the main
   * client just like it does with ioredis.
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
  ): void | Promise<number> {
    const promise = this.connect().then((client) => client.publish(channel, message))

    if (!callback) {
      return promise
    }

    promise.then(
      (count) => callback(null, count),
      (error) => callback(error, undefined)
    )
  }

  /**
   * Subscriptions are not part of this prototype. node-redis requires a
   * dedicated client for pub/sub (like ioredis does), so the shape of
   * the solution is known, it is just not implemented yet.
   */
  subscribe(): void {
    throw new RuntimeException(
      'Pub/Sub is not implemented for node-redis connections. Use "await connection.connect()" and subscribe using a duplicated client'
    )
  }

  /**
   * See "subscribe"
   */
  unsubscribe(): Promise<void> {
    return Promise.reject(
      new RuntimeException('Pub/Sub is not implemented for node-redis connections')
    )
  }

  /**
   * See "subscribe"
   */
  psubscribe(): void {
    throw new RuntimeException(
      'Pub/Sub is not implemented for node-redis connections. Use "await connection.connect()" and subscribe using a duplicated client'
    )
  }

  /**
   * See "subscribe"
   */
  punsubscribe(): Promise<void> {
    return Promise.reject(
      new RuntimeException('Pub/Sub is not implemented for node-redis connections')
    )
  }

  /**
   * Define a custom command using a LUA script. You can run the
   * registered command using the "runCommand" method.
   *
   * ioredis defines the script on the client and exposes it as a method.
   * node-redis has its own "scripts" option, but it must be given at
   * client creation time, hence we keep the scripts around and EVAL
   * them from "runCommand".
   */
  defineCommand(
    name: string,
    definition: { lua?: string; numberOfKeys?: number; readOnly?: boolean }
  ): this {
    this.#scripts[name] = definition
    return this
  }

  /**
   * Run a pre-registered command
   *
   * @example
   * ```ts
   * connection.defineCommand('setAndGet', {
   *   lua: 'redis.call("set", KEYS[1], ARGV[1]) return redis.call("get", KEYS[1])',
   *   numberOfKeys: 1,
   * })
   *
   * await connection.runCommand('setAndGet', 'greeting', 'hello')
   * ```
   */
  async runCommand(command: string, ...args: any[]): Promise<any> {
    const script = this.#scripts[command]
    if (!script || !script.lua) {
      throw new RuntimeException(`Cannot run undefined command "${command}"`)
    }

    const client = await this.connect()
    const numberOfKeys = script.numberOfKeys ?? 0

    return client.eval(script.lua, {
      keys: args.slice(0, numberOfKeys).map((key) => String(key)),
      arguments: args.slice(numberOfKeys).map((value) => String(value)),
    })
  }
}

export interface NodeRedisConnection extends NodeRedisCommands {}

/**
 * Proxy the supported node-redis commands to the underlying client. The
 * "await this.connect()" call is what makes the async connect
 * transparent to the end user.
 */
nodeRedisMethods.forEach((method) => {
  ;(NodeRedisConnection.prototype as any)[method] = async function nodeRedisConnectionProxyFn(
    ...args: any[]
  ) {
    const client = await this.connect()
    return client[method](...args)
  }
})

export default NodeRedisConnection
