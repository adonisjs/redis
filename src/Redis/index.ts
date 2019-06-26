/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../../adonis-typings/redis.ts" />

import { Exception } from '@poppinss/utils'

import { RedisFactory } from '../RedisFactory'
import { RedisClusterFactory } from '../RedisClusterFactory'
import { ioMethods } from '../ioMethods'

/**
 * Redis class exposes the API to interact with a redis server. It automatically
 * re-uses the old connections.
 */
export class Redis {
  /**
   * A copy of live connections. We avoid re-creating a new connection
   * everytime and re-use connections.
   */
  private _connectionPools: { [key: string]: RedisClusterFactory | RedisFactory } = {}

  private _cleanup = function cleanup (connection: RedisClusterFactory | RedisFactory) {
    delete this._connectionPools[connection.connectionName]
  }.bind(this)

  constructor (private _config: any) {
  }

  /**
   * Returns default connnection name
   */
  private _getDefaultConnection (): string {
    return this._config.connection
  }

  /**
   * Returns redis factory for a given named connection
   */
  public connection (name?: string): any {
    /**
     * Using default connection name when actual
     * name is missing
     */
    name = name || this._getDefaultConnection()

    /**
     * Return cached driver, when it's already cached
     */
    if (this._connectionPools[name]) {
      return this._connectionPools[name]
    }

    const config = this._config[name]

    /**
     * Raise error if config for the given name is missing
     */
    if (!config) {
      throw new Exception(`Define config for ${name} connection inside config/redis file`)
    }

    this._connectionPools[name] = config.clusters
      ? new RedisClusterFactory(name, config)
      : new RedisFactory(name, config)

    this._connectionPools[name].on('end', this._cleanup)
    return this._connectionPools[name]
  }

  public async quit (connection?: string): Promise<void> {
    connection = connection || this._getDefaultConnection()
    if (!this._connectionPools[connection]) {
      return
    }

    return this.connection(connection).quit()
  }

  public async disconnect (connection?: string): Promise<void> {
    connection = connection || this._getDefaultConnection()
    if (!this._connectionPools[connection]) {
      return
    }

    return this.connection(connection).disconnect()
  }
}

ioMethods.forEach((method) => {
  Redis.prototype[method] = function redisProxyFn (...args: any[]) {
    return this.connection()[method](...args)
  }
})
