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
  private connectionPools: { [key: string]: RedisClusterFactory | RedisFactory } = {}

  /**
   * An array of connections with health checks enabled, which means, we always
   * create a connection for them, even when they are not used.
   */
  private healthCheckConnections = Object.keys(this.config.connections)
    .filter((connection) => this.config.connections[connection].healthCheck)

  /**
   * A boolean to know whether health checks have been enabled on one
   * or more redis connections or not.
   */
  public get healthChecksEnabled () {
    return this.healthCheckConnections.length > 0
  }

  constructor (private container: IocContract, private config: RedisConfigContract) {
    super()
  }

  /**
   * Returns default connnection name
   */
  private getDefaultConnection (): string {
    return this.config.connection
  }

  /**
   * Returns an existing connection using it's name or the
   * default connection,
   */
  private getExistingConnection (connection?: string) {
    connection = connection || this.getDefaultConnection()
    return this.connectionPools[connection]
  }

  /**
   * Returns config for a given connection
   */
  private getConnectionConfig (name: string) {
    return this.config.connections[name]
  }

  /**
   * Returns redis factory for a given named connection
   */
  public connection (name?: string): any {
    /**
     * Using default connection name when actual
     * name is missing
     */
    name = name || this.getDefaultConnection()

    /**
     * Return cached connection
     */
    if (this.connectionPools[name]) {
      return this.connectionPools[name]
    }

    const config = this.getConnectionConfig(name)

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
    const factory = this.connectionPools[name] = config.clusters
      ? new RedisClusterFactory(name, config, this.container)
      : new RedisFactory(name, config, this.container)

    /**
     * Stop tracking the connection after it's removed
     */
    factory.on('end', ([connection]) => {
      delete this.connectionPools[connection.connectionName]
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
    const factory = this.getExistingConnection(connection)
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
    const factory = this.getExistingConnection(connection)
    if (!factory) {
      return
    }

    return factory.disconnect()
  }

  /**
   * Quit all connections
   */
  public async quitAll (): Promise<void> {
    await Promise.all(Object.keys(this.connectionPools).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   */
  public async disconnectAll (): Promise<void> {
    await Promise.all(Object.keys(this.connectionPools).map((name) => this.disconnect(name)))
  }

  /**
   * Returns the report for all connections marked for `healthChecks`
   */
  public async report () {
    const reports = await Promise.all(this.healthCheckConnections.map((connection) => {
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
