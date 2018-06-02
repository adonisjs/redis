'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const proxyHandler = exports = module.exports = {}

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

  const connection = target.connection()
  if (typeof (connection[name]) === 'function') {
    return connection[name].bind(connection)
  }

  return target.connection()[name]
}
