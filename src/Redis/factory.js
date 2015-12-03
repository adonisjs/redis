'use strict'

/**
 * adonis-redis
 * Copyright(c) 2015-2015 Harminder Virk
 * MIT Licensed
 */

require('harmony-reflect')
const ioRedis = require('ioredis')
const proxy = require('./proxy')
const co = require('co')

class RedisFactory {

  constructor (config, useCluster) {
    /**
     * storing redis handlers for pub/sub
     * @type {Object}
     */
    this.subscribers = {}
    this.config = config
    this.useCluster = useCluster || false
    this.activeChannel = null
    this.redis = this.newConnection()

    /**
     * listening to redis message event on pub/sub channel
     */
    this.redis.on('message', (channel, message) => {
      this._handleMessage(channel, message)
    })

    /**
     * finally returning proxied object for proxying methods
     * on ioRedis
     */
    return new Proxy(this, proxy)
  }

  /**
   * @description calls handler attached to pub/sub subscriber
   * @method _handleMessage
   * @param  {String} channel
   * @param  {Mixed} message
   * @return {void}
   * @public
   */
  _handleMessage (channel, message) {
    const subscriber = this.subscribers[channel]
    return co(function *() {
      return yield subscriber.handler(message, channel)
    })
  }

  /**
   * @description gets subscriber from subscribers list
   * @method _getSubscriber
   * @param  {String} name
   * @return {Object}
   * @private
   */
  _getSubscriber (name) {
    return this.subscribers[name]
  }

  /**
   * @description sets a new subscriber
   * @method _setSubscriber
   * @param {String} name
   * @param {Object} hash
   * @private
   */
  _setSubscriber (name, hash) {
    this.subscribers[name] = hash
  }

  /**
   * @description removes a given subscriber
   * @method _removeSubscriber
   * @param {String} name
   * @private
   */
  _removeSubscriber (name) {
    delete this.subscribers[name]
  }

  /**
   * @description sets up a new redis connection with
   * default configuration
   * @method newConnection
   * @return {Object}
   * @public
   */
  newConnection () {
    if(this.useCluster){
      return new ioRedis.Cluster(this.config)
    }
    return new ioRedis(this.config)
  }

  /**
   * @description publish to redis using publish connection
   * @method publish
   * @param  {String} channel
   * @param  {Mixed} message
   * @return {void}
   * @public
   */
  publish (channel, message) {
    /**
     * lazy loading publisher connection on demand
     */
    if(!this.publisher) {
      this.publisher = this.newConnection()
    }
    this.publisher.publish(channel, message)
  }

  /**
   * @description subscribes to a given channel on redis pub/sub
   * @method subscribe
   * @param  {String} channel
   * @param  {function} handler
   * @return {void}
   * @public
   */
  subscribe (channel, handler) {
    this.activeChannel = channel
    this._setSubscriber(channel, {handler})
    this.redis.subscribe(channel, (error, counts) => {
      const subscriber = this._getSubscriber(channel)
      /**
       * removing subscriber on error
       */
      if(error) {
        this._removeSubscriber(channel)
      }

      /**
       * calling done method if defined
       */
      if(subscriber.done) {
        subscriber.done(error, counts)
      }
    })
    return this
  }

  /**
   * @description defines callback to execute after subscribtion
   * has been completed
   * @method done
   * @param  {Function} callback
   * @return {void}
   */
  done (callback) {
    const handler = this._getSubscriber(this.activeChannel)
    this.activeChannel = null
    handler.done = callback
  }

  /**
   * @description creates a new pipleline for sending batch
   * commands to Redis
   * @method pipleline
   * @param  {function} handler
   * @return {void}
   */
  pipeline (handler) {
    const pipeline = this.redis.pipeline()
    return co(function * () {
      return yield handler(pipeline)
    })
  }
}

module.exports = RedisFactory
