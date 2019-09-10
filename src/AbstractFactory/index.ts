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
import { PubSubChannelHandler, PubSubPatternHandler } from '@ioc:Adonis/Addons/Redis'

/**
 * Abstract factory implements the shared functionality required by Redis cluster
 * and normal Redis connections.
 */
export abstract class AbstractFactory<T extends (Redis | Cluster)> extends Emitter {
  public ioConnection: T
  public ioSubscriberConnection?: T

  protected $subscriptions: Map<string, PubSubChannelHandler> = new Map()
  protected $psubscriptions: Map<string, PubSubPatternHandler> = new Map()

  /**
   * IocResolver to resolve bindings
   */
  private _resolver: IocResolverContract

  /**
   * Returns an anonymous function by parsing the IoC container
   * binding.
   */
  private _resolveIoCBinding (handler: string): PubSubChannelHandler | PubSubPatternHandler {
    return (...args: any[]) => {
      return this._resolver.call(handler, undefined, args)
    }
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
    this._resolver = container.getResolver(undefined, 'redisListeners', 'App/Listeners')
  }

  /**
   * The events proxying is required, since ioredis itself doesn't cleanup
   * listeners after closing the redis connection and since closing a
   * connection is a async operation, we have to wait for the `end`
   * event on the actual connection and then remove listeners.
   */
  protected $proxyConnectionEvents () {
    this.ioConnection.on('connect', () => this.emit('connect'))
    this.ioConnection.on('ready', () => this.emit('ready'))
    this.ioConnection.on('error', (error: any) => this.emit('error', error))
    this.ioConnection.on('close', () => this.emit('close'))
    this.ioConnection.on('reconnecting', () => this.emit('reconnecting'))

    /**
     * Cluster only events
     */
    this.ioConnection.on('+node', (node: Redis) => this.emit('node:added', node))
    this.ioConnection.on('-node', (node: Redis) => this.emit('node:removed', node))
    this.ioConnection.on('node error', (error: any, address: string) => {
      this.emit('node:error', { error, address })
    })

    /**
     * On end, we must cleanup client and self listeners
     */
    this.ioConnection.on('end', async () => {
      this.ioConnection.removeAllListeners()

      try {
        await this.emit('end', this)
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
    this.ioSubscriberConnection!.on('connect', () => this.emit('subscriber:connect'))
    this.ioSubscriberConnection!.on('ready', () => this.emit('subscriber:ready'))
    this.ioSubscriberConnection!.on('error', (error: any) => this.emit('subscriber:error', error))
    this.ioSubscriberConnection!.on('close', () => this.emit('subscriber:close'))
    this.ioSubscriberConnection!.on('reconnecting', () => this.emit('subscriber:reconnecting'))

    /**
     * On subscriber connection end, we must clear registered
     * subscriptions and client event listeners.
     */
    this.ioSubscriberConnection!.on('end', async () => {
      this.ioConnection.removeAllListeners()

      try {
        await this.emit('subscriber:end', this)
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
        this.emit('subscription:error', error)
        return
      }

      if (typeof (handler) === 'string') {
        handler = this._resolveIoCBinding(handler) as PubSubChannelHandler
      }

      this.emit('subscription:ready', count)
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
        this.emit('psubscription:error', error)
        return
      }

      if (typeof (handler) === 'string') {
        handler = this._resolveIoCBinding(handler) as PubSubPatternHandler
      }

      this.emit('psubscription:ready', count)
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
}
