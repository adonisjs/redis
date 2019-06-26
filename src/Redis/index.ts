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

  /**
   * A method to cleanup memory after a connection has been
   * closed.
   */
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
   * Returns an existing connection using it's name or the
   * default connection,
   */
  private _getExistingConnection (connection?: string) {
    connection = connection || this._getDefaultConnection()
    return this._connectionPools[connection]
  }

  /**
   * Returns redis factory for a given named connection
   */
  public connection (connection?: string): any {
    /**
     * Using default connection name when actual
     * name is missing
     */
    connection = connection || this._getDefaultConnection()

    /**
     * Return cached driver, when it's already cached
     */
    if (this._connectionPools[connection]) {
      return this._connectionPools[connection]
    }

    const config = this._config[connection]

    /**
     * Raise error if config for the given name is missing
     */
    if (!config) {
      throw new Exception(`Define config for ${connection} connection inside config/redis file`)
    }

    /**
     * Create connection and store inside the connection pools
     * object, so that we can re-use it later
     */
    const factory = this._connectionPools[connection] = config.clusters
      ? new RedisClusterFactory(connection, config)
      : new RedisFactory(connection, config)

    /**
     * Hook into end event to cleanup memory
     */
    factory.on('end', this._cleanup)

    /**
     * Return connection
     */
    return factory
  }

  /**
   * Quit a named connection or the default connection when no
   * name is defined.
   */
  public async quit (connection?: string): Promise<void> {
    const factory = this._getExistingConnection(connection)
    if (!factory) {
      return
    }

    return factory.quit()
  }

  /**
   * Disconnect a named connection or the default connection when no
   * name is defined.
   */
  public async disconnect (connection?: string): Promise<void> {
    const factory = this._getExistingConnection(connection)
    if (!factory) {
      return
    }

    return factory.disconnect()
  }

  /**
   * Quit all connections
   */
  public async quitAll (): Promise<void[]> {
    return Promise.all(Object.keys(this._connectionPools).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   */
  public async disconnectAll (): Promise<void[]> {
    return Promise.all(Object.keys(this._connectionPools).map((name) => this.disconnect(name)))
  }
}

/**
 * Copy redis commands to the prototype and each command
 * is executed agains the default connection
 */
ioMethods.forEach((method) => {
  Redis.prototype[method] = function redisProxyFn (...args: any[]) {
    return this.connection()[method](...args)
  }
})
