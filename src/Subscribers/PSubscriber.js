'use strict'

'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const BaseSubscriber = require('./BaseSubscriber')
const debug = require('debug')('adonis:redis')

class PSubscriber extends BaseSubscriber {
  constructor (patterns, handler) {
    super(patterns, handler)
    debug('initiating new psubscriber for %j patterns', patterns)
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
  _callHandler (pattern, channel, message) {
    this._makeHandler(this.handler)(message, channel, pattern)
  }

  /**
   * dispatches the new message received for a given
   * pattern by calling the attached handler
   *
   * @param  {String} pattern
   * @param  {String} channel
   * @param  {Mixed} message
   *
   * @public
   */
  newMessage (pattern, channel, message) {
    if (this.inTopics(pattern)) {
      this._callHandler(pattern, channel, message)
    }
  }

  /**
   * unsubscribes from a given pattern
   *
   * @param  {Array} patterns
   *
   * @public
   */
  unsubscribe (patterns) {
    super.unsubscribe(patterns)
    debug('unsubscribing from %j patterns', patterns)
  }
}

module.exports = PSubscriber
