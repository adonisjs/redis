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
import * as errors from '../errors.js'
import type {
  PubSubOptions,
  ConnectionEvents,
  PubSubChannelHandler,
  PubSubPatternHandler,
} from '../types.js'

/**
 * Abstract factory implements the shared functionality required by Redis cluster
 * and the normal Redis connections.
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
   * A list of active subscriptions and pattern subscription
   */
  protected subscriptions: Map<string, PubSubChannelHandler> = new Map()
  protected psubscriptions: Map<string, PubSubPatternHandler> = new Map()

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
   */
  isConnecting() {
    return this.status === 'connecting' || this.status === 'reconnecting'
  }

  /**
   * Returns a boolean notifying if the connection is in
   * ready state
   */
  isReady() {
    return this.status === 'ready' || this.status === 'connect'
  }

  /**
   * Returns a boolean notifying if the connection has been closed
   */
  isClosed() {
    return this.status === 'end' || this.status === 'close'
  }

  /**
   * Parent class must implement makeSubscriberConnection
   */
  protected abstract makeSubscriberConnection(): void

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
      const handler = this.subscriptions.get(channel)
      if (handler) {
        handler(message)
      }
    })

    /**
     * Listen for pattern messages
     */
    this.ioSubscriberConnection!.on('pmessage', (pattern, channel, message) => {
      const handler = this.psubscriptions.get(pattern)
      if (handler) {
        handler(channel, message)
      }
    })
  }

  /**
   * Gracefully end the redis connection
   */
  async quit() {
    await this.ioConnection.quit()
    if (this.ioSubscriberConnection) {
      await this.ioSubscriberConnection.quit()
    }
  }

  /**
   * Forcefully end the redis connection
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
   */
  subscribe(channel: string, handler: PubSubChannelHandler, options?: PubSubOptions): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.setupSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this.subscriptions.has(channel)) {
      throw new errors.E_MULTIPLE_REDIS_SUBSCRIPTIONS([channel])
    }

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
        this.subscriptions.set(channel, handler)
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
   */
  unsubscribe(channel: string) {
    this.subscriptions.delete(channel)
    return this.ioSubscriberConnection!.unsubscribe(channel)
  }

  /**
   * Make redis subscription for a pattern
   */
  psubscribe(pattern: string, handler: PubSubPatternHandler, options?: PubSubOptions): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.setupSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this.psubscriptions.has(pattern)) {
      throw new errors.E_MULTIPLE_REDIS_PSUBSCRIPTIONS([pattern])
    }

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
        this.psubscriptions.set(pattern, handler)
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
   */
  punsubscribe(pattern: string) {
    this.psubscriptions.delete(pattern)
    return this.ioSubscriberConnection!.punsubscribe(pattern)
  }

  /**
   * Publish the pub/sub message
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
   */
  defineCommand(...args: Parameters<Redis['defineCommand']>): this {
    this.ioConnection.defineCommand(...args)
    return this
  }

  /**
   * Run a pre registered command
   */
  runCommand(command: string, ...args: any[]): any {
    // @ts-ignore
    return this.ioConnection[command](...args)
  }
}
