'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const ServiceProvider = require('adonis-fold').ServiceProvider

class RedisFactoryProvider extends ServiceProvider {

  * register () {
    this.app.bind('Adonis/Addons/RedisFactory', function () {
      return require('../src/RedisFactory')
    })
  }

}

module.exports = RedisFactoryProvider
