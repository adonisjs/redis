'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

require('harmony-reflect')
const IoRedis = require('ioredis')
const _ = require('lodash')
const NE = require('node-exceptions')
const CatLog = require('cat-log')
const logger = new CatLog('adonis:redis')
const RedisSubscriber = require('../Subscribers/Subscriber')
const RedisPSubscriber = require('../Subscribers/PSubscriber')
const proxyHandler = require('./proxyHandler')

class RedisFactory {

  constructor (config, useCluster) {
    this.config = config
    this.useCluster = useCluster || false

    this.redis = this._newConnection()
    this.subscriberConnection = null
    this.subscribers = []
    this.psubscribers = []

    return new Proxy(this, proxyHandler)
  }

  /**
   * creates subscriber connection if does not
   * exists already
   *
   * @private
   */
  _createSubscriberConnection () {
    if (!this.subscriberConnection) {
      logger.verbose('creating new subscriber connection')
      this.subscriberConnection = this._newConnection()
      this._bindListeners()
    }
  }

  /**
   * binds redis message listenrs
   *
   * @private
   */
  _bindListeners () {
    this.subscriberConnection.on('message', this._notifySubscribers.bind(this))
    this.subscriberConnection.on('pmessage', this._notifyPsubscribers.bind(this))
  }

  /**
   * sets up a new redis connection with default configuration
   *
   * @return {Object}
   *
   * Example config for cluster
   *  {
   *    clusters: [{
   *      port: 6380,
   *      host: '127.0.0.1'
   *    }],
   *    redisOptions: {}
   *  }
   *
   * @private
   */
  _newConnection () {
    if (this.useCluster) {
      logger.verbose('creating new redis cluster using config: %j', this.config)
      return new IoRedis.Cluster(this.config.clusters, {redisOptions: this.config.redisOptions})
    }
    logger.verbose('creating new redis connection using config: %j', this.config)
    return new IoRedis(this.config)
  }

  /**
   * notify all the subscribers when a new message is received
   * and they will decided whether to consume the message or
   * not
   *
   * @param   {String} channel
   * @param   {Mixed} message
   *
   * @private
   */
  _notifySubscribers (channel, message) {
    logger.verbose('notifying subscribers for message in %s channel payload: %j', channel, message)
    this.subscribers.forEach((subscriber) => subscriber.newMessage(channel, message))
  }

  /**
   * notify all the subscribers when a new message is received
   * and they will decided whether to consume the message or
   * not
   *
   * @param   {String} pattern
   * @param   {String} channel
   * @param   {Mixed} message
   *
   * @private
   */
  _notifyPsubscribers (pattern, channel, message) {
    logger.verbose('notifying psubscribers for new message of %s pattern in %s channel payload: %j', pattern, channel, message)
    this.psubscribers.forEach((subscriber) => subscriber.newMessage(pattern, channel, message))
  }

  /**
   * create a redis subscription, it can be using subscribe or psubscribe
   * method.
   *
   * @param   {Object} subscriberInstance
   * @param   {Mixed} subscriptionPayload
   * @param   {String} type
   *
   * @private
   */
  _subscribe (subscriberInstance, subscriptionPayload, type) {
    this._createSubscriberConnection()
    const redisMethod = type === 'subscriber' ? 'subscribe' : 'psubscribe'
    const instanceProperty = type === 'subscriber' ? 'subscribers' : 'psubscribers'
    this[instanceProperty].push(subscriberInstance)
    this.subscriberConnection[redisMethod].apply(this.subscriberConnection, subscriptionPayload)
  }

  /**
   * unsubscribe from a given channel/pattern based on the type
   *
   * @param   {Array} channels
   * @param   {Array} handler
   * @param   {String} type
   *
   * @private
   */
  _unsubscribe (channels, handler, type) {
    let subscriptionPayload = []
    if (typeof (handler) !== 'function') {
      channels = channels.concat([handler])
      subscriptionPayload = channels
    } else {
      subscriptionPayload = channels.concat([handler])
    }

    this._createSubscriberConnection()
    const redisMethod = type === 'subscriber' ? 'unsubscribe' : 'punsubscribe'
    const instanceProperty = type === 'subscriber' ? 'subscribers' : 'psubscribers'
    this.subscriberConnection[redisMethod].apply(this.subscriberConnection, subscriptionPayload)

    /**
     * removing the channels from individual subscriber and
     * removing it's instance all together when subscriber
     * has zero channels.
     */
    _.remove(this[instanceProperty], (subscriber) => {
      subscriber.unsubscribe(channels)
      return !subscriber.hasTopics()
    })
  }

  /**
   * validates the handler attached to listen to the subscribed messages.
   * Strings will be resolved using the IoC container.
   *
   * @param   {String|Function} handler
   * @throws {InvalidArgumentException} If handler is not resolved as a function
   *
   * @private
   */
  _validateHandler (handler) {
    if (typeof (handler) !== 'function') {
      throw new NE.InvalidArgumentException('subscriber needs a handler to listen for new messages')
    }
  }

  /**
   * subscribe to number of redis channels.
   *
   * @param {...Spread} channels
   * @param {Function} handler
   *
   * @return {Object} Subscriber instance
   *
   * @example
   * Redis.subscribe('news', 'entertainment', function * (message, channel) {
   * })
   * OR
   * Redis.subscribe('news', 'entertainment', 'MediaSubscriber.message')
   *
   * @public
   */
  subscribe () {
    const channels = _.initial(arguments)
    const handler = _.last(arguments)
    this._validateHandler(handler)
    const subscriberInstance = new RedisSubscriber(channels, handler)
    const subscriptionPayload = channels.concat([subscriberInstance.onSubscribe.bind(subscriberInstance)])
    this._subscribe(subscriberInstance, subscriptionPayload, 'subscriber')
    return subscriberInstance
  }

  /**
   * adds a new psubscriber to listen for new messages
   *
   * @return {Object} Psubscriber instance
   *
   * @example
   * Redis.psubscribe('h?llo', function * (message, channel) {
   * })
   * OR
   * Redis.subscribe('h?llo', 'GreetingSubscriber.message')
   *
   * @public
   */
  psubscribe () {
    const patterns = _.initial(arguments)
    const handler = _.last(arguments)
    this._validateHandler(handler)
    const psubscriberInstance = new RedisPSubscriber(patterns, handler)
    const subscriptionPayload = patterns.concat([psubscriberInstance.onSubscribe.bind(psubscriberInstance)])
    this._subscribe(psubscriberInstance, subscriptionPayload, 'psubscriber')
    return psubscriberInstance
  }

  /**
   * unsubscribe from one or multiple redis channels
   *
   * @param {...Spread} channels
   * @param {Function} [handler]
   *
   * @public
   */
  unsubscribe () {
    this._unsubscribe(_.initial(arguments), _.last(arguments), 'subscriber')
  }

  /**
   * unsubscribe from one or multiple redis channels
   *
   * @param {...Spread} channels
   * @param {Function} [handler]
   *
   * @public
   */
  punsubscribe () {
    this._unsubscribe(_.initial(arguments), _.last(arguments), 'psubscriber')
  }

  /**
   * publishes a new message to a given channel
   *
   * @param {...Spread} channels
   * @param {Mixed} data
   *
   * @public
   */
  publish () {
    this.redis.publish.apply(this.redis, _.toArray(arguments))
  }

  /**
   * closes redis and subscriber connection together
   *
   * @return {Promise}
   *
   * @public
   */
  quit () {
    const quitArray = [this.redis.quit()]
    if (this.subscriberConnection) {
      quitArray.push(this.subscriberConnection.quit())
    }
    return Promise.all(quitArray)
  }

}

module.exports = RedisFactory
