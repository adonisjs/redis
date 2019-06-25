/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import * as Redis from 'ioredis'
import { ClusterConfigContract } from '@ioc:Adonis/Addons/Redis'

import { ioMethods } from '../ioMethods'
import { AbstractFactory } from '../AbstractFactory'

/**
 * Redis cluster factory exposes the API to run Redis commands unsing `ioredis` as the
 * underlying client. The factory abstracts the need of creating and managing
 * multiple pub/sub connections by hand, since it handles that internally
 * by itself.
 */
export class RedisClusterFactory extends AbstractFactory<Redis.Cluster> {
  constructor (private _config: ClusterConfigContract) {
    super()
    this.connection = new Redis.Cluster(this._config.clusters, this._config.clusterOptions)
    this.$proxyConnectionEvents()
  }

  /**
   * Creates the subscriber connection, the [[AbstractFactory]] will
   * invoke this method when first subscription is created.
   */
  protected $makeSubscriberConnection () {
    this.subscriberConnection = new Redis.Cluster(this._config.clusters, this._config.clusterOptions)
  }
}

ioMethods.forEach((method) => {
  RedisClusterFactory.prototype[method] = function redisFactoryProxyFn (...args: any[]) {
    return this.connection[method](...args)
  }
})
