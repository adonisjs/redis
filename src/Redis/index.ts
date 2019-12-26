/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../../adonis-typings/redis.ts" />

import Emitter from 'emittery'
import { Exception } from '@poppinss/utils'
import { IocContract } from '@adonisjs/fold'
import {
  ReportNode,
  RedisContract,
  RedisConfigContract,
  RedisClusterEventsList,
} from '@ioc:Adonis/Addons/Redis'

import { RedisFactory } from '../RedisFactory'
import { RedisClusterFactory } from '../RedisClusterFactory'

/**
 * Redis class exposes the API to interact with a redis server. It automatically
 * re-uses the old connections.
 */
export class Redis extends Emitter.Typed<RedisClusterEventsList<any>> implements RedisContract {
  /**
   * A copy of live connections. We avoid re-creating a new connection
   * everytime and re-use connections.
   */
  private _connectionPools: { [key: string]: RedisClusterFactory | RedisFactory } = {}

  /**
   * An array of connections with health checks enabled, which means, we always
   * create a connection for them, even when they are not used.
   */
  private _healthCheckConnections = Object.keys(this._config.connections)
    .filter((connection) => this._config.connections[connection].healthCheck)

  /**
   * A boolean to know whether health checks have been enabled on one
   * or more redis connections or not.
   */
  public get healthChecksEnabled () {
    return this._healthCheckConnections.length > 0
  }

  constructor (private _container: IocContract, private _config: RedisConfigContract) {
    super()
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
   * Returns config for a given connection
   */
  private _getConnectionConfig (name: string) {
    return this._config.connections[name]
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
     * Return cached connection
     */
    if (this._connectionPools[name]) {
      return this._connectionPools[name]
    }

    const config = this._getConnectionConfig(name)

    /**
     * Raise error if config for the given name is missing
     */
    if (!config) {
      throw new Exception(`Define config for ${name} connection inside config/redis file`)
    }

    /**
     * Create connection and store inside the connection pools
     * object, so that we can re-use it later
     */
    const factory = this._connectionPools[name] = config.clusters
      ? new RedisClusterFactory(name, config, this._container)
      : new RedisFactory(name, config, this._container)

    factory.on('end', ([connection]) => {
      delete this._connectionPools[connection.connectionName]
    })

    /**
     * Proxying all events from each factory
     */
    factory.onAny((event: any, data) => {
      this.emit(event, data)
    })

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
  public async quitAll (): Promise<void> {
    await Promise.all(Object.keys(this._connectionPools).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   */
  public async disconnectAll (): Promise<void> {
    await Promise.all(Object.keys(this._connectionPools).map((name) => this.disconnect(name)))
  }

  /**
   * Returns the report for all connections marked for `healthChecks`
   */
  public async report () {
    const reports = await Promise.all(this._healthCheckConnections.map((connection) => {
      return this.connection(connection).getReport(true)
    })) as ReportNode[]

    const healthy = !reports.find((report) => !!report.error)
    return {
      health: {
        healthy,
        message: healthy ? 'All connections are healthy' : 'One or more redis connections are not healthy',
      },
      meta: reports,
    }
  }
}
