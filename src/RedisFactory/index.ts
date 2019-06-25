/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import * as Redis from 'ioredis'
import * as Emitter from 'emittery'
import { Exception } from '@poppinss/utils'

import {
  ConnectionConfigContract,
  PubSubChannelHandler,
  PubSubPatternHandler,
} from '@ioc:Adonis/Addons/Redis'

import { ioMethods } from '../ioMethods'

/**
 * Redis factory exposes the API to run Redis commands unsing `ioredis` as the
 * underlying client. The factory abstracts the need of creating and managing
 * multiple pub/sub connections by hand, since it handles that internally
 * by itself.
 */
export class RedisFactory extends Emitter {
  public connection: Redis.Redis
  public subscriberConnection?: Redis.Redis

  /**
   * A copy of subscriptions on the given redis connection
   */
  private _subscriptions: Map<string, PubSubChannelHandler> = new Map()

  /**
   * A copy of pattern subscriptions on the given redis connection
   */
  private _psubscriptions: Map<string, PubSubPatternHandler> = new Map()

  constructor (private _config: ConnectionConfigContract) {
    super()
    this.connection = new Redis(this._config)
    this._proxyConnectionEvents()
  }

  /**
   * The events proxying is required, since ioredis itself doesn't cleanup
   * listeners after closing the redis connection and since closing a
   * connection is a async operation, we have to wait for the `end`
   * event on the actual connection and then remove listeners.
   */
  private _proxyConnectionEvents () {
    this.connection.on('connect', () => this.emit('connect'))
    this.connection.on('ready', () => this.emit('ready'))
    this.connection.on('error', (error) => this.emit('error', error))
    this.connection.on('close', () => this.emit('close'))
    this.connection.on('reconnecting', () => this.emit('reconnecting'))
    this.connection.on('end', async () => {
      this.connection.removeAllListeners()

      try {
        await this.emit('end')
      } catch (error) {
      }

      this.clearListeners()
    })
  }

  /**
   * Notifying the subscriber for the message on the given
   * channel.
   */
  private _notifySubscriber (channel: string, message: any) {
    const subscription = this._subscriptions.get(channel)
    if (!subscription) {
      return
    }

    /**
     * Notifying subscription handler
     */
    subscription(message)
  }

  /**
   * Notifying subscriber of a given pattern
   */
  private _notifyPSubscriber (pattern: string, channel: string, message: any) {
    const subscription = this._psubscriptions.get(pattern)
    if (!subscription) {
      return
    }

    /**
     * Notifying subscription handler
     */
    subscription(channel, message)
  }

  /**
   * Making the subscriber connection and proxying it's events. The method
   * results in a noop, in case of an existing subscriber connection.
   */
  private _makeSubscriberConnection () {
    if (this.subscriberConnection) {
      return
    }

    this.subscriberConnection = new Redis(this._config)
    this.subscriberConnection.on('message', this._notifySubscriber.bind(this))
    this.subscriberConnection.on('pmessage', this._notifyPSubscriber.bind(this))

    /**
     * Proxying subscriber events, so that we can prefix them with `subscriber:`.
     * Also make sure not to clear the events of this class on subscriber
     * disconnect
     */
    this.connection.on('connect', () => this.emit('subscriber:connect'))
    this.connection.on('ready', () => this.emit('subscriber:ready'))
    this.connection.on('error', (error) => this.emit('subscriber:error', error))
    this.connection.on('close', () => this.emit('subscriber:close'))
    this.connection.on('reconnecting', () => this.emit('subscriber:reconnecting'))
    this.connection.on('end', async () => {
      this.connection.removeAllListeners()

      try {
        await this.emit('subscriber:end')
      } catch (error) {
      }

      /**
       * Cleanup subscriptions map
       */
      this._subscriptions.clear()
      this._psubscriptions.clear()
    })
  }

  /**
   * Gracefully end the redis connection
   */
  public async quit () {
    await this.connection.quit()

    if (this.subscriberConnection) {
      await this.subscriberConnection.quit()
    }
  }

  /**
   * Forcefull end the redis connection
   */
  public async disconnect () {
    await this.connection.disconnect()

    if (this.subscriberConnection) {
      await this.subscriberConnection.disconnect()
    }
  }

  /**
   * Subscribe to a given channel to receive Redis pub/sub events. A
   * new subscriber connection will be created/managed automatically.
   */
  public subscribe (channel: string, handler: PubSubChannelHandler): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this._makeSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this._subscriptions.has(channel)) {
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
    this.subscriberConnection!.subscribe(channel, (error: any, count: number) => {
      if (error) {
        this.emit('subscription:error', error)
        return
      }

      this.emit('subscription:ready', count)
      this._subscriptions.set(channel, handler)
    })
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribe (channel: string) {
    this._subscriptions.delete(channel)
    return this.subscriberConnection!.unsubscribe(channel)
  }

  /**
   * Make redis subscription for a pattern
   */
  public psubscribe (pattern: string, handler: PubSubPatternHandler): void {
    /**
     * Make the subscriber connection. The method results in a noop when
     * subscriber connection already exists.
     */
    this._makeSubscriberConnection()

    /**
     * Disallow multiple subscriptions to a single channel
     */
    if (this._psubscriptions.has(pattern)) {
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
    const psubscribe = (this.subscriberConnection!.psubscribe) as any

    psubscribe.bind(this.subscriberConnection!)(pattern, (error: any, count: number) => {
      if (error) {
        this.emit('psubscription:error', error)
        return
      }

      this.emit('psubscription:ready', count)
      this._psubscriptions.set(pattern, handler)
    })
  }

  /**
   * Unsubscribe from a given pattern
   */
  public punsubscribe (pattern: string) {
    this._psubscriptions.delete(pattern)
    return this.subscriberConnection!.punsubscribe(pattern)
  }
}

/**
 * Since types in AdonisJs are derived from interfaces, we take the leverage
 * of dynamically adding redis methods to the class prototype.
 */
ioMethods.forEach((method) => {
  RedisFactory.prototype[method] = function redisFactoryProxyFn (...args: any[]) {
    return this.connection[method](...args)
  }
})
