/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../../adonis-typings/redis.ts" />

import { IocContract } from '@adonisjs/fold'
import { EmitterContract } from '@ioc:Adonis/Core/Event'
import { Exception, ManagerConfigValidator } from '@poppinss/utils'

import {
  RedisConfig,
  HealthReportNode,
  RedisManagerContract,
  RedisConnectionContract,
  RedisClusterConnectionContract,
} from '@ioc:Adonis/Addons/Redis'

import { RedisConnection } from '../RedisConnection'
import { RedisClusterConnection } from '../RedisClusterConnection'

/**
 * Redis manager exposes the API to interact with a redis server.
 */
export class RedisManager implements RedisManagerContract {
  /**
   * An array of connections with health checks enabled, which means, we always
   * create a connection for them, even when they are not used.
   */
  private healthCheckConnections = Object.keys(this.config.connections)
    .filter((connection) => this.config.connections[connection].healthCheck)

  /**
   * A copy of live connections. We avoid re-creating a new connection
   * everytime and re-use connections.
   */
  public activeConnections: {
    [key: string]: RedisClusterConnectionContract | RedisConnectionContract
  } = {}

  /**
   * A boolean to know whether health checks have been enabled on one
   * or more redis connections or not.
   */
  public get healthChecksEnabled () {
    return this.healthCheckConnections.length > 0
  }

  /**
   * Returns the length of active connections
   */
  public get activeConnectionsCount () {
    return Object.keys(this.activeConnections).length
  }

  constructor (
    private container: IocContract,
    private config: RedisConfig,
    private emitter: EmitterContract,
  ) {
    this.validateConfig()
  }

  /**
   * Validate config at runtime
   */
  private validateConfig () {
    const validator = new ManagerConfigValidator(this.config, 'redis', 'config/redis')
    validator.validateDefault('connection')
    validator.validateList('connections', 'connection')
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
  private getExistingConnection (name?: string) {
    name = name || this.getDefaultConnection()
    return this.activeConnections[name]
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
     * Using default connection name when actual name is missing
     */
    name = name || this.getDefaultConnection()

    /**
     * Return cached connection
     */
    if (this.activeConnections[name]) {
      return this.activeConnections[name]
    }

    const config = this.getConnectionConfig(name)

    /**
     * Raise error if config for the given name is missing
     */
    if (!config) {
      throw new Exception(`Define config for "${name}" connection inside "config/redis" file`)
    }

    /**
     * Create connection and store inside the connection pools
     * object, so that we can re-use it later
     */
    const connection = this.activeConnections[name] = config.clusters
      ? new RedisClusterConnection(name, config, this.container) as unknown as RedisClusterConnectionContract
      : new RedisConnection(name, config, this.container) as unknown as RedisConnectionContract

    /**
     * Stop tracking the connection after it's removed
     */
    connection.on('end', ($connection) => {
      delete this.activeConnections[$connection.connectionName]
      this.emitter.emit('redis:end', $connection)
    })

    connection.on('ready', ($connection) => this.emitter.emit('redis:ready', $connection))
    connection.on('error', (error, $connection) => this.emitter.emit('redis:error', [error, $connection]))

    /**
     * Return connection
     */
    return connection
  }

  /**
   * Quit a named connection or the default connection when no
   * name is defined.
   */
  public async quit (name?: string): Promise<void> {
    const connection = this.getExistingConnection(name)
    if (!connection) {
      return
    }

    return connection.quit()
  }

  /**
   * Disconnect a named connection or the default connection when no
   * name is defined.
   */
  public async disconnect (name?: string): Promise<void> {
    const connection = this.getExistingConnection(name)
    if (!connection) {
      return
    }

    return connection.disconnect()
  }

  /**
   * Quit all connections
   */
  public async quitAll (): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   */
  public async disconnectAll (): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.disconnect(name)))
  }

  /**
   * Returns the report for all connections marked for `healthChecks`
   */
  public async report () {
    const reports = await Promise.all(this.healthCheckConnections.map((connection) => {
      return this.connection(connection).getReport(true)
    })) as HealthReportNode[]

    const healthy = !reports.find((report) => !!report.error)
    return {
      displayName: 'Redis',
      health: {
        healthy,
        message: healthy ? 'All connections are healthy' : 'One or more redis connections are not healthy',
      },
      meta: reports,
    }
  }
}
