/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../../adonis-typings/redis.ts" />

import * as Redis from 'ioredis'
import { ClusterConfigContract } from '@ioc:Adonis/Addons/Redis'

import { ioMethods } from '../ioMethods'
import { AbstractFactory } from '../AbstractFactory'

/**
 * Redis cluster factory exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The factory abstracts the need of creating and managing
 * multiple pub/sub connections by hand, since it handles that internally
 * by itself.
 */
export class RedisClusterFactory extends AbstractFactory<Redis.Cluster> {
  constructor (connectionName: string, private _config: ClusterConfigContract) {
    super(connectionName)
    this.ioConnection = new Redis.Cluster(this._config.clusters, this._config.clusterOptions)
    this.$proxyConnectionEvents()
  }

  /**
   * Creates the subscriber connection, the [[AbstractFactory]] will
   * invoke this method when first subscription is created.
   */
  protected $makeSubscriberConnection () {
    this.ioSubscriberConnection = new Redis.Cluster(this._config.clusters, this._config.clusterOptions)
  }

  /**
   * Returns cluster nodes
   */
  public nodes (role?: Redis.NodeRole) {
    return this.ioConnection.nodes(role)
  }
}

ioMethods.forEach((method) => {
  RedisClusterFactory.prototype[method] = function redisFactoryProxyFn (...args: any[]) {
    return this.ioConnection[method](...args)
  }
})
