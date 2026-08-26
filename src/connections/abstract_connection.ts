/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'
import type { Redis, Cluster } from 'ioredis'
import type {
  PubSubOptions,
  ConnectionEvents,
  PubSubChannelHandler,
  PubSubPatternHandler,
} from '../types.ts'

/**
 * Abstract factory implements the shared functionality required by Redis cluster
 * and the normal Redis connections.
 *
 * @example
 * ```ts
 * class MyConnection extends AbstractConnection<Redis, MyEvents> {
 *   protected makeSubscriberConnection() {
 *     // Implementation specific to your connection type
 *   }
 * }
 * ```
 */
export abstract class AbstractConnection<
  T extends Redis | Cluster,
  Events extends ConnectionEvents<any>,
> extends Emittery<Events> {
  /**
   * Reference to the main ioRedis connection
   */
  declare ioConnection: T

  /**
   * Reference to the main ioRedis subscriber connection
   */
  declare ioSubscriberConnection?: T

  /**
   * A list of active subscriptions
   */
  protected subscriptions: Map<string, Set<PubSubChannelHandler>> = new Map()

  /**
   * A list of active pattern subscriptions
   */
  protected psubscriptions: Map<string, Set<PubSubPatternHandler>> = new Map()

  /**
   * The last error emitted by the `error` event. We set it to `null` after
   * the `ready` event
   */
  lastError?: any

  /**
   * Returns status of the main connection
   */
  get status() {
    return this.ioConnection.status
  }

  /**
   * Returns status of the subscriber connection or
   * undefined when there is no subscriber
   * connection
   */
  get subscriberStatus() {
    return this.ioSubscriberConnection?.status
  }

  /**
   * Get the number of commands queued in automatic pipelines.
   * This is not available (and returns 0) until the cluster is connected and slots information have been received.
   */
  get autoPipelineQueueSize() {
    return this.ioConnection.autoPipelineQueueSize
  }

  /**
   * Returns a boolean notifying if the connection is
   * in connecting state
   *
   * @example
   * ```ts
   * if (connection.isConnecting()) {
   *   console.log('Connection is establishing...')
   * }
   * ```
   */
  isConnecting() {
    return this.status === 'connecting' || this.status === 'reconnecting'
  }

  /**
   * Returns a boolean notifying if the connection is in
   * ready state
   *
   * @example
   * ```ts
   * if (connection.isReady()) {
   *   await connection.ioConnection.set('key', 'value')
   * }
   * ```
   */
  isReady() {
    return this.status === 'ready' || this.status === 'connect'
  }

  /**
   * Returns a boolean notifying if the connection has been closed
   *
   * @example
   * ```ts
   * if (connection.isClosed()) {
   *   console.log('Connection is closed')
   * }
   * ```
   */
  isClosed() {
    return this.status === 'end' || this.status === 'close'
  }

  /**
   * Parent class must implement makeSubscriberConnection
   */
  protected abstract makeSubscriberConnection(): void

  /**
   * Create a new AbstractConnection instance
   *
   * @param connectionName - Name identifier for this connection
   *
   * @example
   * ```ts
   * class MyConnection extends AbstractConnection {
   *   constructor() {
   *     super('main')
   *   }
   * }
   * ```
   */
  constructor(public connectionName: string) {
    super()
  }

  /**
   * Monitoring the redis connection via event emitter to cleanup
   * things properly and also notify subscribers of this class
   */
  protected monitorConnection() {
    this.ioConnection.on('connect', () => this.emit('connect', { connection: this }))
    this.ioConnection.on('wait', () => this.emit('wait', { connection: this }))
    this.ioConnection.on('ready', () => {
      /**
       * We must set the error to null when server is ready for accept
       * commands
       */
      this.lastError = null
      this.emit('ready', { connection: this })
    })

    this.ioConnection.on('error', (error: any) => {
      this.lastError = error
      this.emit('error', { error, connection: this })
    })

    this.ioConnection.on('close', () => this.emit('close', { connection: this }))
    this.ioConnection.on('reconnecting', (waitTime: number) =>
      this.emit('reconnecting', { connection: this, waitTime })
    )

    /**
     * Cluster only events
     */
    this.ioConnection.on('+node', (node: Redis) =>
      this.emit('node:added', { connection: this, node })
    )
    this.ioConnection.on('-node', (node: Redis) =>
      this.emit('node:removed', { connection: this, node })
    )
    this.ioConnection.on('node error', (error: any, address: string) => {
      this.emit('node:error', { error, address, connection: this })
    })

    /**
     * On end, we must cleanup client and self listeners
     */
    this.ioConnection.on('end', async () => {
      this.ioConnection.removeAllListeners()
      this.emit('end', { connection: this }).finally(() => {
        this.clearListeners([
          'connect',
          'wait',
          'ready',
          'error',
          'close',
          'reconnecting',
          'node:added',
          'node:error',
          'node:removed',
          'end',
        ])
      })
    })
  }

  /**
   * Monitoring the subscriber connection via event emitter to
   * cleanup things properly and also notify subscribers of
   * this class.
   */
  protected monitorSubscriberConnection() {
    this.ioSubscriberConnection!.on('connect', () =>
      this.emit('subscriber:connect', { connection: this })
    )
    this.ioSubscriberConnection!.on('ready', () =>
      this.emit('subscriber:ready', { connection: this })
    )
    this.ioSubscriberConnection!.on('error', (error: any) => {
      this.emit('subscriber:error', { error, connection: this })
    })
    this.ioSubscriberConnection!.on('close', () =>
      this.emit('subscriber:close', { connection: this })
    )
    this.ioSubscriberConnection!.on('reconnecting', (waitTime: number) =>
      this.emit('subscriber:reconnecting', { connection: this, waitTime })
    )

    /**
     * On subscriber connection end, we must clear registered
     * subscriptions and client event listeners.
     */
    this.ioSubscriberConnection!.on('end', async () => {
      this.ioSubscriberConnection!.removeAllListeners()
      this.emit('subscriber:end', { connection: this })

      /**
       * Cleanup subscriptions
       */
      this.subscriptions.clear()
      this.psubscriptions.clear()

      this.ioSubscriberConnection = undefined
      this.clearListeners([
        'subscriber:connect',
        'subscriber:ready',
        'subscriber:error',
        'subscriber:close',
        'subscriber:reconnecting',
        'subscriber:end',
      ])
    })
  }

  /**
   * Setting up the subscriber connection. The method results
   * in a noop when a connection already exists.
   */
  protected setupSubscriberConnection() {
    if (this.ioSubscriberConnection) {
      return
    }

    /**
     * Ask child class to setup the subscriber connection
     */
    this.makeSubscriberConnection()

    /**
     * Listen for messages
     */
    this.ioSubscriberConnection!.on('message', (channel, message) => {
      const handlers = this.subscriptions.get(channel)
      if (handlers) {
        for (const handler of handlers) {
          handler(message)
        }
      }
    })

    /**
     * Listen for pattern messages
     */
    this.ioSubscriberConnection!.on('pmessage', (pattern, channel, message) => {
      const handlers = this.psubscriptions.get(pattern)
      if (handlers) {
        for (const handler of handlers) {
          handler(channel, message)
        }
      }
    })
  }

  /**
   * Gracefully end the redis connection
   *
   * @example
   * ```ts
   * await connection.quit()
   * ```
   */
  async quit() {
    await this.quitIoConnection(this.ioConnection)
    if (this.ioSubscriberConnection) {
      await this.quitIoConnection(this.ioSubscriberConnection)
    }
  }

  /**
   * Gracefully end an IORedis connection based upon its status
   *
   * @param ioConnection - The IORedis connection to quit
   */
  protected async quitIoConnection(ioConnection: T) {
    /**
     * A connection in the "wait" status has never dialed the server (lazy
     * connect) and has no pending commands either, since issuing a command
     * moves it to the "connecting" status synchronously. Quitting it would
     * dial the server only to send the QUIT command, so we disconnect
     * instead.
     */
    if (ioConnection.status === 'wait') {
      ioConnection.disconnect()
      return
    }

    /**
     * Nothing to quit once the connection has ended. IORedis rejects
     * commands issued on an ended connection.
     */
    if (ioConnection.status === 'end') {
      return
    }

    await ioConnection.quit()
  }

  /**
   * Forcefully end the redis connection
   *
   * @example
   * ```ts
   * await connection.disconnect()
   * ```
   */
  async disconnect() {
    await this.ioConnection.disconnect()
    if (this.ioSubscriberConnection) {
      await this.ioSubscriberConnection.disconnect()
    }
  }

  /**
   * Subscribe to a given channel to receive Redis pub/sub events. A
   * new subscriber connection will be created/managed automatically.
   *
   * @param channel - The channel name to subscribe to
   * @param handler - Function to handle received messages
   * @param options - Optional subscription configuration
   *
   * @example
   * ```ts
   * connection.subscribe('notifications', (message) => {
   *   console.log('Received:', message)
   * })
   * ```
   */
  subscribe(channel: string, handler: PubSubChannelHandler, options?: PubSubOptions): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.setupSubscriberConnection()

    /**
     * If the subscriptions map is empty, it means we have no active subscriptions
     * on the given channel, hence we should make one subscription and also set
     * the subscription handler.
     */
    this.ioSubscriberConnection!.subscribe(channel)
      .then((count) => {
        if (options?.onSubscription) {
          options?.onSubscription(count as number)
        }
        this.emit('subscription:ready', { count: count as number, connection: this })
        const subscriptions = this.subscriptions.get(channel)
        if (subscriptions) {
          subscriptions.add(handler)
        } else {
          this.subscriptions.set(channel, new Set([handler]))
        }
      })
      .catch((error) => {
        if (options?.onError) {
          options?.onError(error)
        }
        this.emit('subscription:error', { error, connection: this })
      })
  }

  /**
   * Unsubscribe from a channel
   *
   * @param channel - The channel name to unsubscribe from
   * @param handler - Optional specific handler to remove
   *
   * @example
   * ```ts
   * await connection.unsubscribe('notifications')
   * ```
   */
  unsubscribe(channel: string, handler?: PubSubChannelHandler) {
    if (handler) {
      const subscriptions = this.subscriptions.get(channel)
      if (subscriptions) {
        subscriptions.delete(handler)
      }

      if (subscriptions && subscriptions.size !== 0) {
        return Promise.resolve()
      }
    } else {
      this.subscriptions.delete(channel)
    }
    return this.ioSubscriberConnection!.unsubscribe(channel)
  }

  /**
   * Make redis subscription for a pattern
   *
   * @param pattern - The pattern to subscribe to
   * @param handler - Function to handle received pattern messages
   * @param options - Optional subscription configuration
   *
   * @example
   * ```ts
   * connection.psubscribe('news.*', (channel, message) => {
   *   console.log(`Channel ${channel}:`, message)
   * })
   * ```
   */
  psubscribe(pattern: string, handler: PubSubPatternHandler, options?: PubSubOptions): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.setupSubscriberConnection()

    /**
     * If the subscriptions map is empty, it means we have no active subscriptions
     * on the given channel, hence we should make one subscription and also set
     * the subscription handler.
     */
    this.ioSubscriberConnection!.psubscribe(pattern)
      .then((count) => {
        if (options?.onSubscription) {
          options?.onSubscription(count as number)
        }
        this.emit('psubscription:ready', { count: count as number, connection: this })
        const psubscriptions = this.psubscriptions.get(pattern)
        if (psubscriptions) {
          psubscriptions.add(handler)
        } else {
          this.psubscriptions.set(pattern, new Set([handler]))
        }
      })
      .catch((error) => {
        if (options?.onError) {
          options?.onError(error)
        }
        this.emit('psubscription:error', { error, connection: this })
      })
  }

  /**
   * Unsubscribe from a given pattern
   *
   * @param pattern - The pattern to unsubscribe from
   * @param handler - Optional specific handler to remove
   *
   * @example
   * ```ts
   * await connection.punsubscribe('news.*')
   * ```
   */
  punsubscribe(pattern: string, handler?: PubSubPatternHandler) {
    if (handler) {
      const psubscriptions = this.psubscriptions.get(pattern)
      if (psubscriptions) {
        psubscriptions.delete(handler)
      }

      if (psubscriptions && psubscriptions.size !== 0) {
        return Promise.resolve()
      }
    } else {
      this.psubscriptions.delete(pattern)
    }

    return this.ioSubscriberConnection!.punsubscribe(pattern)
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
   * const count = await connection.publish('notifications', 'Hello World')
   *
   * // Callback-based
   * connection.publish('notifications', 'Hello World', (err, count) => {
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
      ? this.ioConnection.publish(channel, message, callback)
      : this.ioConnection.publish(channel, message)
  }

  /**
   * Define a custom command using LUA script. You can run the
   * registered command using the "runCommand" method.
   *
   * @param args - Arguments for defining the command
   *
   * @example
   * ```ts
   * connection.defineCommand('myCommand', {
   *   numberOfKeys: 1,
   *   lua: 'return redis.call("get", KEYS[1])'
   * })
   * ```
   */
  defineCommand(...args: Parameters<Redis['defineCommand']>): this {
    this.ioConnection.defineCommand(...args)
    return this
  }

  /**
   * Run a pre registered command
   *
   * @param command - The name of the registered command
   * @param args - Arguments to pass to the command
   *
   * @example
   * ```ts
   * const result = await connection.runCommand('myCommand', 'key1')
   * ```
   */
  runCommand(command: string, ...args: any[]): any {
    // @ts-ignore
    return this.ioConnection[command](...args)
  }
}
