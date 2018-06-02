'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/
let proxyHandler = exports = module.exports = {}

/**
 * proxies the target attributes and returns defined implementation
 * for them
 *
 * @param  {Object} target
 * @param  {String} name
 *
 * @return {Mixed}
 * @public
 */
proxyHandler.get = function (target, name) {
  /**
   * Node.js inspecting target
   */
  if (typeof (name) === 'symbol' || name === 'inspect') {
    return target[name]
  }

  /**
   * Property exists on target
   */
  if (typeof (target[name]) !== 'undefined') {
    return target[name]
  }

  if (typeof (target.connection[name]) === 'function') {
    return target.connection[name].bind(target.connection)
  }

  /**
   * Fallback to redis connection
   */
  return target.connection[name]
}
