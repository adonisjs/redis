/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { EventEmitter } from 'node:events'
import { Redis, Cluster } from 'ioredis'
import { Exception } from '@poppinss/utils'

import { ApplicationService } from '@adonisjs/core/types'
import { PubSubChannelHandler, PubSubPatternHandler, HealthReportNode } from './types/main.js'

/**
 * Helper to sleep
 */
const sleep = () => new Promise<void>((resolve) => setTimeout(resolve, 1000))

/**
 * Abstract factory implements the shared functionality required by Redis cluster
 * and normal Redis connections.
 */
export abstract class AbstractConnection<T extends Redis | Cluster> extends EventEmitter {
  /**
   * Reference to the main ioRedis connection
   */
  ioConnection!: T

  /**
   * Reference to the main ioRedis subscriber connection
   */
  ioSubscriberConnection?: T

  /**
   * Number of times `getReport` was deferred, at max we defer it for 3 times
   */
  #deferredReportAttempts = 0

  /**
   * The last error emitted by the `error` event. We set it to `null` after
   * the `ready` event
   */
  #lastError?: any

  /**
   * A list of active subscription and pattern subscription
   */
  protected subscriptions: Map<string, PubSubChannelHandler> = new Map()
  protected psubscriptions: Map<string, PubSubPatternHandler> = new Map()

  /**
   * Returns the memory usage for a given connection
   */
  async #getUsedMemory() {
    const memory = await (this.ioConnection as Redis).info('memory')
    const memorySegment = memory
      .split(/\r|\r\n/)
      .find((line) => line.trim().startsWith('used_memory_human'))
    return memorySegment ? memorySegment.split(':')[1] : 'unknown'
  }

  /**
   * Returns status of the main connection
   */
  get status(): string {
    return (this.ioConnection as Redis).status
  }

  /**
   * Returns status of the subscriber connection or
   * undefined when there is no subscriber
   * connection
   */
  get subscriberStatus(): string | undefined {
    if (!this.ioSubscriberConnection) {
      return
    }

    return (this.ioSubscriberConnection as Redis).status
  }

  /**
   * Parent class must implement makeSubscriberConnection
   */
  protected abstract makeSubscriberConnection(): void

  constructor(
    public connectionName: string,
    application: ApplicationService
  ) {
    super()
  }

  /**
   * The events proxying is required, since ioredis itself doesn't cleanup
   * listeners after closing the redis connection and since closing a
   * connection is an async operation, we have to wait for the `end`
   * event on the actual connection and then remove listeners.
   */
  protected proxyConnectionEvents() {
    this.ioConnection.on('connect', () => this.emit('connect', this))
    this.ioConnection.on('ready', () => {
      /**
       * We must set the error to null when server is ready for accept
       * command
       */
      this.#lastError = null
      this.emit('ready', this)
    })

    this.ioConnection.on('error', (error: any) => {
      this.#lastError = error
      this.emit('error', error, this)
    })

    this.ioConnection.on('close', () => this.emit('close', this))
    this.ioConnection.on('reconnecting', () => this.emit('reconnecting', this))

    /**
     * Cluster only events
     */
    this.ioConnection.on('+node', (node: Redis) => this.emit('node:added', this, node))
    this.ioConnection.on('-node', (node: Redis) => this.emit('node:removed', this, node))
    this.ioConnection.on('node error', (error: any, address: string) => {
      this.emit('node:error', error, address, this)
    })

    /**
     * On end, we must cleanup client and self listeners
     */
    this.ioConnection.on('end', async () => {
      this.ioConnection.removeAllListeners()
      this.emit('end', this)
      this.removeAllListeners()
    })
  }

  /**
   * Making the subscriber connection and proxying it's events. The method
   * results in a noop, in case of an existing subscriber connection.
   */
  protected setupSubscriberConnection() {
    if (this.ioSubscriberConnection) {
      return
    }

    /**
     * Ask parent class to setup the subscriber connection
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

    /**
     * Proxying subscriber events, so that we can prefix them with `subscriber:`.
     * Also make sure not to clear the events of this class on subscriber
     * disconnect
     */
    this.ioSubscriberConnection!.on('connect', () => this.emit('subscriber:connect', this))
    this.ioSubscriberConnection!.on('ready', () => this.emit('subscriber:ready', this))
    this.ioSubscriberConnection!.on('error', (error: any) =>
      this.emit('subscriber:error', error, this)
    )
    this.ioSubscriberConnection!.on('close', () => this.emit('subscriber:close', this))
    this.ioSubscriberConnection!.on('reconnecting', () =>
      this.emit('subscriber:reconnecting', this)
    )

    /**
     * On subscriber connection end, we must clear registered
     * subscriptions and client event listeners.
     */
    this.ioSubscriberConnection!.on('end', async () => {
      this.ioConnection.removeAllListeners()
      this.emit('subscriber:end', this)

      /**
       * Cleanup subscriptions map
       */
      this.subscriptions.clear()
      this.psubscriptions.clear()
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
  subscribe(channel: string, handler: PubSubChannelHandler): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.setupSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this.subscriptions.has(channel)) {
      throw new Exception(`"${channel}" channel already has an active subscription`, {
        code: 'E_MULTIPLE_REDIS_SUBSCRIPTIONS',
        status: 500,
      })
    }

    /**
     * If the subscriptions map is empty, it means we have no active subscriptions
     * on the given channel, hence we should make one subscription and also set
     * the subscription handler.
     */
    const connection = this.ioSubscriberConnection as Redis
    connection
      .subscribe(channel)
      .then((count) => {
        this.emit('subscription:ready', count, this)
        this.subscriptions.set(channel, handler)
      })
      .catch((error) => {
        this.emit('subscription:error', error, this)
      })
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string) {
    this.subscriptions.delete(channel)
    return (this.ioSubscriberConnection as Redis).unsubscribe(channel)
  }

  /**
   * Make redis subscription for a pattern
   */
  psubscribe(pattern: string, handler: PubSubPatternHandler): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.setupSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this.psubscriptions.has(pattern)) {
      throw new Exception(`${pattern} pattern already has an active subscription`, {
        status: 500,
        code: 'E_MULTIPLE_REDIS_PSUBSCRIPTIONS',
      })
    }

    /**
     * If the subscriptions map is empty, it means we have no active subscriptions
     * on the given channel, hence we should make one subscription and also set
     * the subscription handler.
     */
    const connection = this.ioSubscriberConnection as Redis

    connection
      .psubscribe(pattern)
      .then((count) => {
        this.emit('psubscription:ready', count, this)
        this.psubscriptions.set(pattern, handler)
      })
      .catch((error) => {
        this.emit('psubscription:error', error, this)
      })
  }

  /**
   * Unsubscribe from a given pattern
   */
  punsubscribe(pattern: string) {
    this.psubscriptions.delete(pattern)
    return (this.ioSubscriberConnection as any).punsubscribe(pattern)
  }

  /**
   * Returns report for the connection
   */
  async getReport(checkForMemory?: boolean): Promise<HealthReportNode> {
    const connection = this.ioConnection as Redis

    /**
     * When status === 'connecting' we maximum wait for 3 times and then send
     * the report. Which means, if we are unable to connect to redis within
     * 3 seconds, we consider the connection unstable.
     */
    if (
      connection.status === 'connecting' &&
      this.#deferredReportAttempts < 3 &&
      !this.#lastError
    ) {
      await sleep()
      this.#deferredReportAttempts++
      return this.getReport(checkForMemory)
    }

    /**
     * Returns the status with the last error when connection status
     * is not in `connect` state.
     */
    if (!['ready', 'connect'].includes(connection.status)) {
      return {
        connection: this.connectionName,
        status: connection.status,
        used_memory: null,
        error: this.#lastError,
      }
    }

    try {
      /**
       * Ping the server for response
       */
      await connection.ping()

      /**
       * Collect memory when checkForMemory = true
       */
      const memory = checkForMemory ? await this.#getUsedMemory() : 'unknown'

      return {
        connection: this.connectionName,
        status: connection.status,
        used_memory: memory,
        error: null,
      }
    } catch (error) {
      return {
        connection: this.connectionName,
        status: connection.status,
        used_memory: null,
        error,
      }
    }
  }

  /**
   * Publish the pub/sub message
   */
  publish(channel: string, message: string, callback?: any) {
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
