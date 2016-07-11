'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const util = exports = module.exports = {}

const toStr = Object.prototype.toString
const fnToStr = Function.prototype.toString
const isFnRegex = /^\s*(?:function)?\*/

util.isGenerator = function (method) {
  const viaToStr = toStr.call(method)
  const viaFnToStr = fnToStr.call(method)
  return (viaToStr === '[object Function]' || viaToStr === '[object GeneratorFunction]') && isFnRegex.test(viaFnToStr)
}
