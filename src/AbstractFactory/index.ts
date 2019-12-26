/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../../adonis-typings/redis.ts" />

import Emitter from 'emittery'
import { Redis, Cluster } from 'ioredis'
import { Exception } from '@poppinss/utils'
import { IocContract, IocResolverContract } from '@adonisjs/fold'
import {
  ReportNode,
  PubSubChannelHandler,
  PubSubPatternHandler,
  RedisClusterEventsList,
} from '@ioc:Adonis/Addons/Redis'

const sleep = () => new Promise((resolve) => setTimeout(resolve, 1000))

/**
 * Abstract factory implements the shared functionality required by Redis cluster
 * and normal Redis connections.
 */
export abstract class AbstractFactory<T extends (Redis | Cluster)> extends Emitter.Typed<RedisClusterEventsList<any>> {
  public ioConnection: T
  public ioSubscriberConnection?: T

  protected $subscriptions: Map<string, PubSubChannelHandler> = new Map()
  protected $psubscriptions: Map<string, PubSubPatternHandler> = new Map()

  /**
   * Number of times `getReport` was deferred, at max we defer it for 3 times
   */
  private deferredReportAttempts = 0

  /**
   * The last error emitted by the `error` event. We set it to `null` after
   * the `ready` event
   */
  private lastError?: any

  /**
   * IocResolver to resolve bindings
   */
  private resolver: IocResolverContract

  /**
   * Returns an anonymous function by parsing the IoC container
   * binding.
   */
  private resolveIoCBinding (handler: string): PubSubChannelHandler | PubSubPatternHandler {
    return (...args: any[]) => {
      return this.resolver.call(handler, undefined, args)
    }
  }

  /**
   * Returns the memory usage for a given connection
   */
  private async getUsedMemory () {
    const memory = await (this.ioConnection as Redis).info('memory')
    const memorySegment = memory.split(/\r|\r\n/).find((line) => line.trim().startsWith('used_memory_human'))
    return memorySegment ? memorySegment.split(':')[1] : 'unknown'
  }

  /**
   * Returns status of the main connection
   */
  public get status (): string {
    return (this.ioConnection as any).status
  }

  /**
   * Returns status of the subscriber connection or
   * undefined when there is no subscriber
   * connection
   */
  public get subscriberStatus (): string | undefined {
    if (!this.ioSubscriberConnection) {
      return
    }

    return (this.ioSubscriberConnection as any).status
  }

  /**
   * Parent class must implement makeSubscriberConnection
   */
  protected abstract $makeSubscriberConnection (): void

  constructor (public connectionName: string, container: IocContract) {
    super()
    this.resolver = container.getResolver(undefined, 'redisListeners', 'App/Listeners')
  }

  /**
   * The events proxying is required, since ioredis itself doesn't cleanup
   * listeners after closing the redis connection and since closing a
   * connection is an async operation, we have to wait for the `end`
   * event on the actual connection and then remove listeners.
   */
  protected $proxyConnectionEvents () {
    this.ioConnection.on('connect', () => this.emit('connect', [this]))
    this.ioConnection.on('ready', () => {
      /**
       * We must set the error to null when server is ready for accept
       * command
       */
      this.lastError = null
      this.emit('ready', [this])
    })

    this.ioConnection.on('error', (error: any) => {
      this.lastError = error
      this.emit('error', [this, error])
    })

    this.ioConnection.on('close', () => this.emit('close', [this]))
    this.ioConnection.on('reconnecting', () => this.emit('reconnecting', [this]))

    /**
     * Cluster only events
     */
    this.ioConnection.on('+node', (node: Redis) => this.emit('node:added', [this, node]))
    this.ioConnection.on('-node', (node: Redis) => this.emit('node:removed', [this, node]))
    this.ioConnection.on('node error', (error: any, address: string) => {
      this.emit('node:error', [this, error, address])
    })

    /**
     * On end, we must cleanup client and self listeners
     */
    this.ioConnection.on('end', async () => {
      this.ioConnection.removeAllListeners()

      try {
        await this.emit('end', [this])
      } catch (error) {
      }

      this.clearListeners()
    })
  }

  /**
   * Making the subscriber connection and proxying it's events. The method
   * results in a noop, in case of an existing subscriber connection.
   */
  protected $setupSubscriberConnection () {
    if (this.ioSubscriberConnection) {
      return
    }

    /**
     * Ask parent class to setup the subscriber connection
     */
    this.$makeSubscriberConnection()

    /**
     * Listen for messages
     */
    this.ioSubscriberConnection!.on('message', (channel, message) => {
      const handler = this.$subscriptions.get(channel)
      if (handler) {
        handler(message)
      }
    })

    /**
     * Listen for pattern messages
     */
    this.ioSubscriberConnection!.on('pmessage', (pattern, channel, message) => {
      const handler = this.$psubscriptions.get(pattern)
      if (handler) {
        handler(channel, message)
      }
    })

    /**
     * Proxying subscriber events, so that we can prefix them with `subscriber:`.
     * Also make sure not to clear the events of this class on subscriber
     * disconnect
     */
    this.ioSubscriberConnection!.on('connect', () => this.emit('subscriber:connect', [this]))
    this.ioSubscriberConnection!.on('ready', () => this.emit('subscriber:ready', [this]))
    this.ioSubscriberConnection!.on('error', (error: any) => this.emit('subscriber:error', [this, error]))
    this.ioSubscriberConnection!.on('close', () => this.emit('subscriber:close', [this]))
    this.ioSubscriberConnection!.on('reconnecting', () => this.emit('subscriber:reconnecting', [this]))

    /**
     * On subscriber connection end, we must clear registered
     * subscriptions and client event listeners.
     */
    this.ioSubscriberConnection!.on('end', async () => {
      this.ioConnection.removeAllListeners()

      try {
        await this.emit('subscriber:end', [this])
      } catch (error) {
      }

      /**
       * Cleanup subscriptions map
       */
      this.$subscriptions.clear()
      this.$psubscriptions.clear()
    })
  }

  /**
   * Gracefully end the redis connection
   */
  public async quit () {
    await this.ioConnection.quit()
    if (this.ioSubscriberConnection) {
      await this.ioSubscriberConnection.quit()
    }
  }

  /**
   * Forcefully end the redis connection
   */
  public async disconnect () {
    await this.ioConnection.disconnect()
    if (this.ioSubscriberConnection) {
      await this.ioSubscriberConnection.disconnect()
    }
  }

  /**
   * Subscribe to a given channel to receive Redis pub/sub events. A
   * new subscriber connection will be created/managed automatically.
   */
  public subscribe (channel: string, handler: PubSubChannelHandler | string): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.$setupSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this.$subscriptions.has(channel)) {
      throw new Exception(
        `${channel} channel already has an active subscription`,
        500,
        'E_MULTIPLE_REDIS_SUBSCRIPTIONS',
      )
    }

    /**
     * If the subscriptions map is empty, it means we have no active subscriptions
     * on the given channel, hence we should make one subscription and also set
     * the subscription handler.
     */
    (this.ioSubscriberConnection as any).subscribe(channel, (error: any, count: number) => {
      if (error) {
        this.emit('subscription:error', [this, error])
        return
      }

      if (typeof (handler) === 'string') {
        handler = this.resolveIoCBinding(handler) as PubSubChannelHandler
      }

      this.emit('subscription:ready', [this, count])
      this.$subscriptions.set(channel, handler)
    })
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribe (channel: string) {
    this.$subscriptions.delete(channel)
    return (this.ioSubscriberConnection as any).unsubscribe(channel)
  }

  /**
   * Make redis subscription for a pattern
   */
  public psubscribe (pattern: string, handler: PubSubPatternHandler | string): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this.$setupSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this.$psubscriptions.has(pattern)) {
      throw new Exception(
        `${pattern} pattern already has an active subscription`,
        500,
        'E_MULTIPLE_REDIS_PSUBSCRIPTIONS',
      )
    }

    /**
     * If the subscriptions map is empty, it means we have no active subscriptions
     * on the given channel, hence we should make one subscription and also set
     * the subscription handler.
     */
    (this.ioSubscriberConnection as any).psubscribe(pattern, (error: any, count: number) => {
      if (error) {
        this.emit('psubscription:error', [this, error])
        return
      }

      if (typeof (handler) === 'string') {
        handler = this.resolveIoCBinding(handler) as PubSubPatternHandler
      }

      this.emit('psubscription:ready', [this, count])
      this.$psubscriptions.set(pattern, handler)
    })
  }

  /**
   * Unsubscribe from a given pattern
   */
  public punsubscribe (pattern: string) {
    this.$psubscriptions.delete(pattern)
    return (this.ioSubscriberConnection as any).punsubscribe(pattern)
  }

  /**
   * Returns report for the connection
   */
  public async getReport (checkForMemory?: boolean): Promise<ReportNode> {
    const connection = this.ioConnection as Redis

    /**
     * When status === 'connecting' we maximum wait for 3 times and then send
     * the report. Which means, if we are unable to connect to redis within
     * 3 seconds, we consider the connection unstable.
     */
    if (connection.status === 'connecting' && this.deferredReportAttempts < 3 && !this.lastError) {
      await sleep()
      this.deferredReportAttempts++
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
        used_memory: 'unknown',
        error: this.lastError,
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
      const memory = checkForMemory ? await this.getUsedMemory() : 'unknown'

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
        used_memory: 'unknown',
        error,
      }
    }
  }
}
