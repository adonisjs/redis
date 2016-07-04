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
const CatLog = require('cat-log')
const logger = new CatLog('adonis:redis')

class Subscriber extends BaseSubscriber {

  constructor (channels, handler) {
    super(channels, handler)
    logger.verbose('initiating new subscriber for %j channels', channels)
  }

  /**
   * unsubscribing from one or multiple channels
   *
   * @param  {Array} channels
   *
   * @public
   */
  unsubscribe (channels) {
    super.unsubscribe(channels)
    logger.verbose('unsubscribing from %j channels', channels)
  }

}

module.exports = Subscriber
