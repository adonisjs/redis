/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { IocContract } from '@adonisjs/fold'
import { Redis } from '../src/Redis'

export default class RedisProvider {
  constructor (protected $container: IocContract) {
  }

  /**
   * Register the redis binding
   */
  public register () {
    this.$container.singleton('Adonis/Addons/Redis', () => {
      const config = this.$container.use('Adonis/Core/Config').get('redis', {})
      return new Redis(config)
    })
  }
}
