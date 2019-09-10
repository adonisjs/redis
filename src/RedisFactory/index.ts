/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../../adonis-typings/redis.ts" />

import Redis from 'ioredis'
import { IocContract } from '@adonisjs/fold'
import { ConnectionConfigContract } from '@ioc:Adonis/Addons/Redis'

import { ioMethods } from '../ioMethods'
import { AbstractFactory } from '../AbstractFactory'

/**
 * Redis factory exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The factory abstracts the need of creating and managing
 * multiple pub/sub connections by hand, since it handles that internally
 * by itself.
 */
export class RedisFactory extends AbstractFactory<Redis.Redis> {
  constructor (
    connectionName: string,
    private _config: ConnectionConfigContract,
    container: IocContract,
  ) {
    super(connectionName, container)
    this.ioConnection = new Redis(this._config)
    this.$proxyConnectionEvents()
  }

  /**
   * Creates the subscriber connection, the [[AbstractFactory]] will
   * invoke this method when first subscription is created.
   */
  protected $makeSubscriberConnection () {
    this.ioSubscriberConnection = new Redis(this._config)
  }
}

/**
 * Since types in AdonisJs are derived from interfaces, we take the leverage
 * of dynamically adding redis methods to the class prototype.
 */
ioMethods.forEach((method) => {
  RedisFactory.prototype[method] = function redisFactoryProxyFn (...args: any[]) {
    return this.ioConnection[method](...args)
  }
})
