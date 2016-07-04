'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const co = require('co')
const _ = require('lodash')

class BaseSubscriber {

  constructor (topics, handler) {
    this.topics = topics
    this.handler = handler
    this.callback = null
  }

  /**
   * this method is executed by ioredis when the
   * subscription to a channel is done.
   *
   * @param  {Error} error
   * @param  {Number} counts
   *
   * @public
   */
  onSubscribe (error, counts) {
    if (typeof (this.callback) === 'function') {
      this.callback(error, counts)
    }
  }

  /**
   * binds a callback to be executed when subscriber is
   * registered sucessfully.
   *
   * @param  {Function} callback
   *
   * @return {Function}
   *
   * @public
   */
  done (callback) {
    this.callback = callback
  }

  /**
   * calls the subscriber handler by wrapping it inside
   * co
   *
   * @param   {String} channel
   * @param   {Mixed} message
   *
   * @private
   */
  _callHandler (topic, message) {
    const handler = this.handler.bind(this)
    co(function * () {
      yield handler(message, topic)
    })
  }

  /**
   * Executes the binded handler only when message
   * belongs to one of the given topics
   *
   * @param  {String} channel
   * @param  {Mixed} message
   *
   * @public
   */
  newMessage (topic, message) {
    if (this.inTopics(topic)) {
      this._callHandler(topic, message)
    }
  }

  /**
   * remove channels from the subscribed list of channels
   *
   * @param  {Array} channels
   *
   * @public
   */
  unsubscribe (topics) {
    this.topics = _.pullAll(this.topics, topics)
  }

  /**
   * returns whether it has topics to listen for
   * or not.
   *
   * @return {Boolean} [description]
   *
   * @public
   */
  hasTopics () {
    return this.getTopics().length
  }

  /**
   * returns list of subscribed topics
   *
   * @return {Array}
   *
   * @public
   */
  getTopics () {
    return this.topics
  }

  /**
   * returns whether a topic belongs to a list
   * of subscribed topics
   *
   * @param  {String} topic
   *
   * @return {Boolean}
   */
  inTopics (topic) {
    return this.topics.indexOf(topic) > -1
  }

}

module.exports = BaseSubscriber
