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

class RedisProvider extends ServiceProvider {

  * register () {
    this.app.singleton('Adonis/Addons/Redis', function (app) {
      const RedisFactory = app.use('Adonis/Addons/RedisFactory')
      const Config = app.use('Adonis/Src/Config')
      const Redis = require('../src/Redis')
      return new Redis(Config, RedisFactory)
    })
  }

}

module.exports = RedisProvider
