'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const { ServiceProvider } = require('@adonisjs/fold')

class RedisProvider extends ServiceProvider {
  register () {
    this.app.bind('Adonis/Addons/RedisFactory', () => require('../src/RedisFactory'))

    this.app.singleton('Adonis/Addons/Redis', (app) => {
      const RedisFactory = app.use('Adonis/Addons/RedisFactory')
      const Config = app.use('Adonis/Src/Config')
      const Redis = require('../src/Redis')
      return new Redis(Config, RedisFactory)
    })

    this.app.alias('Adonis/Addons/Redis', 'Redis')
  }
}

module.exports = RedisProvider
