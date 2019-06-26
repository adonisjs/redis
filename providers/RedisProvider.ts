/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { Redis } from '../src/Redis'

export default class RedisProvider {
  constructor (protected $container: any) {
  }

  /**
   * Register the redis binding
   */
  public register () {
    this.$container.singleton('Adonis/Addons/Redis', () => {
      const config = this.$container.use('Adonis/Src/Config')
      return new Redis(config.get('redis', {
        connection: 'primary',
      }))
    })
  }
}
