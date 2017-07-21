'use strict'

/*
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const NE = require('node-exceptions')

class InvalidArgumentException extends NE.InvalidArgumentException {
  static missingConfig (file, key) {
    return new this(`Cannot get configuration for ${key} key from config/${file}.js file`, 500, 'E_MISSING_CONFIG')
  }
}

module.exports = { InvalidArgumentException, RuntimeException: NE.RuntimeException }
