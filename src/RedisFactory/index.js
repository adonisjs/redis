'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const _ = require('lodash')
const IoRedis = require('ioredis')
const debug = require('debug')('adonis:redis')
const { resolver } = require('@adonisjs/fold')
const GE = require('@adonisjs/generic-exceptions')

const proxyHandler = require('./proxyHandler')

class RedisFactory {
  constructor (config, useCluster = false) {
    this._config = config
    this._useCluster = useCluster

    /**
     * The main redis connection.
     *
     * @attribute connection
     *
     * @type {Object}
     */
    this.connection = null

    /**
     * The list of subscribers for different channels
     *
     * @type {Array}
     */
    this.subscribers = {}

    /**
     * The list of psubscribers for different channels
     *
     * @type {Array}
     */
    this.psubscribers = {}

    /**
     * The connection for subscribers, this connection is created
     * automatically when you register a subscriber.
     */
    this.subscriberConnection = null

    /**
     * Connect to redis
     */
    this.connect()

    return new Proxy(this, proxyHandler)
  }

  /**
   * Create a new redis connection
   *
   * @method _newConnection
   *
   * @return {Object}
   *
   * @example
   * ```js
   *  {
   *    clusters: [{
   *      port: 6380,
   *      host: '127.0.0.1'
   *    }],
   *    redisOptions: {}
   *  }
   * ```
   *
   * @private
   */
  _newConnection () {
    if (this._useCluster) {
      debug('creating new redis cluster using config: %j', this._config)
      return new IoRedis.Cluster(this._config.clusters, { redisOptions: this._config.redisOptions })
    }
    debug('creating new redis connection using config: %j', this._config)
    return new IoRedis(this._config)
  }

  /**
   * This method is invoked when redis pub/sub receives
   * a new message, it's job is to call the registered
   * subscribers
   *
   * @method _executeSubscribeListeners
   *
   * @param  {String}                  channel
   * @param  {Mixed}                  message
   *
   * @return {void}
   *
   * @private
   */
  _executeSubscribeListeners (channel, message) {
    if (typeof (this.subscribers[channel]) === 'function') {
      this.subscribers[channel](message, channel)
    }
  }

  /**
   * This method is invoked when redis psubscribe receives
   * a new message, it's job is to call the registered
   * subscribers
   *
   * @method _executePSubscribeListeners
   *
   * @param  {String}                 pattern
   * @param  {String}                 channel
   * @param  {Mixed}                  message
   *
   * @return {void}
   *
   * @private
   */
  _executePSubscribeListeners (pattern, channel, message) {
    if (typeof (this.psubscribers[pattern]) === 'function') {
      this.psubscribers[pattern](pattern, message, channel)
    }
  }

  /**
   * Closes the redis connection first by removing
   * all attached listeners
   *
   * @method _closeConnection
   *
   * @param  {Object}         connection
   *
   * @return {Promise}
   *
   * @private
   */
  _closeConnection (connection) {
    debug('closing redis connection')
    return new Promise((resolve, reject) => {
      connection.quit((response) => {
        connection.removeAllListeners()
        return response
      }).then(resolve).catch(reject)
    })
  }

  /**
   * Creates subscribe connection only if doesn't
   * exists
   *
   * @method _setupSubscriberConnection
   *
   * @return {void}
   *
   * @private
   */
  _setupSubscriberConnection () {
    if (!this.subscriberConnection) {
      debug('creating new subscription connection')
      this.subscriberConnection = this._newConnection()
      this.subscriberConnection.on('message', this._executeSubscribeListeners.bind(this))
      this.subscriberConnection.on('pmessage', this._executePSubscribeListeners.bind(this))
    }
  }

  /**
   * Creates a new redis connection
   *
   * @method connect
   *
   * @return {void}
   */
  connect () {
    this.connection = this._newConnection()
  }

  /**
   * Subscribe to a channel
   *
   * @method subscribe
   * @async
   *
   * @param  {String}  channel
   * @param  {Function|String}  handler
   *
   * @return {void}
   */
  subscribe (channel, handler) {
    return new Promise((resolve, reject) => {
      if (typeof (handler) !== 'function' && typeof (handler) !== 'string') {
        throw GE
          .InvalidArgumentException
          .invalidParameter('Redis.subscribe needs a callback function or ioc reference string', handler)
      }

      const { method } = resolver.forDir('listeners').resolveFunc(handler)
      this._setupSubscriberConnection()

      /**
       * Cannot have multiple subscribers on a single channel
       */
      if (this.subscribers[channel]) {
        reject(GE.RuntimeException.invoke(`Cannot subscribe to ${channel} channel twice`))
        return
      }

      /**
       * Otherwise subscribe with redis
       */
      debug('setting up subscriber for %s', channel)
      this.subscriberConnection.subscribe(channel, (error, count) => {
        if (error) {
          reject(error)
          return
        }
        this.subscribers[channel] = method
        resolve()
      })
    })
  }

  /**
   * Subscribe to a pattern on redis
   *
   * @method psubscribe
   * @async
   *
   * @param  {String}   pattern
   * @param  {Function|String}   handler
   *
   * @return {void}
   */
  psubscribe (pattern, handler) {
    return new Promise((resolve, reject) => {
      if (typeof (handler) !== 'function' && typeof (handler) !== 'string') {
        throw GE
          .InvalidArgumentException
          .invalidParameter('Redis.psubscribe needs a callback function or ioc reference string', handler)
      }

      const { method } = resolver.forDir('listeners').resolveFunc(handler)
      this._setupSubscriberConnection()

      /**
       * Cannot have multiple subscribers on a single channel
       */
      if (this.psubscribers[pattern]) {
        reject(new Error(`Cannot subscribe to ${pattern} pattern twice`))
        return
      }

      /**
       * Otherwise subscribe with redis
       */
      debug('setting up psubscriber for %s', pattern)
      this.subscriberConnection.psubscribe(pattern, (error, count) => {
        if (error) {
          reject(error)
          return
        }
        this.psubscribers[pattern] = method
        resolve()
      })
    })
  }

  /**
   * Unsubscribe from a channel. If there are no subscribers for
   * any channels, this method will close the subscription
   * connection with redis.
   *
   * @method unsubscribe
   * @async
   *
   * @param  {String}    channel
   *
   * @return {String}   `OK` is return if unsubscribed
   */
  unsubscribe (channel) {
    return new Promise((resolve, reject) => {
      _.unset(this.subscribers, channel)

      if (!this.subscriberConnection) {
        resolve('OK')
      }

      this
        .subscriberConnection
        .unsubscribe(channel)
        .then(() => {
          /**
           * Close subscriber connection when there are no
           * subscribers for any channels
           */
          if (_.size(this.subscribers) === 0) {
            return this._closeConnection(this.subscriberConnection)
          }
          return 'OK'
        }).then(resolve).catch(reject)
    })
  }

  /**
   * Unsubscribe from a pattern. If there are no subscribers for
   * any patterns, this method will close the subscription
   * connection with redis.
   *
   * @method punsubscribe
   * @async
   *
   * @param  {String}    pattern
   *
   * @return {String}   `OK` is return if unsubscribed
   */
  punsubscribe (pattern) {
    return new Promise((resolve, reject) => {
      _.unset(this.psubscribers, pattern)

      if (!this.subscriberConnection) {
        resolve('OK')
      }

      this
        .subscriberConnection
        .punsubscribe(pattern)
        .then(() => {
          /**
           * Close subscriber connection when there are no
           * subscribers for any patterns
           */
          if (_.size(this.psubscribers) === 0) {
            return this._closeConnection(this.subscriberConnection)
          }
          return 'OK'
        }).then(resolve).catch(reject)
    })
  }

  /**
   * Closes redis connection
   *
   * @return {Promise}
   *
   * @public
   */
  quit () {
    return Promise.all(_([this.connection, this.subscriberConnection])
      .filter((connection) => connection && connection.status !== 'end')
      .map((connection) => this._closeConnection(connection))
      .value())
  }
}

module.exports = RedisFactory
