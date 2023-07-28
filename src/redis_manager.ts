/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RuntimeException } from '@poppinss/utils'

import debug from './debug.js'
import RedisConnection from './connections/redis_connection.js'
import RedisClusterConnection from './connections/redis_cluster_connection.js'
import type { GetConnectionType, RedisConnectionsList } from './types/main.js'

/**
 * Redis Manager exposes the API to manage multiple redis connections
 * based upon user defined config.
 *
 * All connections are long-lived until they are closed explictly
 */
export default class RedisManager<ConnectionsList extends RedisConnectionsList> {
  /**
   * User provided config
   */
  #config: {
    connection: keyof ConnectionsList
    connections: ConnectionsList
  }

  /**
   * A copy of live connections. We avoid re-creating a new connection
   * everytime and re-use connections.
   */
  activeConnections: {
    [K in keyof ConnectionsList]?: GetConnectionType<ConnectionsList, K>
  } = {}

  /**
   * Returns the length of active connections
   */
  get activeConnectionsCount() {
    return Object.keys(this.activeConnections).length
  }

  constructor(config: { connection: keyof ConnectionsList; connections: ConnectionsList }) {
    this.#config = config
  }

  /**
   * Returns redis factory for a given named connection
   */
  connection<ConnectionName extends keyof ConnectionsList>(
    connectionName?: ConnectionName
  ): GetConnectionType<ConnectionsList, ConnectionName> {
    const name = connectionName || this.#config.connection
    debug('resolving connection %s', name)

    /**
     * Return existing connection if already exists
     */
    if (this.activeConnections[name]) {
      debug('reusing existing connection %s', name)
      return this.activeConnections[name] as GetConnectionType<ConnectionsList, ConnectionName>
    }

    /**
     * Get config for the named connection
     */
    const config = this.#config.connections[name]
    if (!config) {
      throw new RuntimeException(`Redis connection "${name.toString()}" is not defined`)
    }

    /**
     * Instantiate the connection based upon the config
     */
    debug('creating new connection %s', name)
    const connection =
      'clusters' in config
        ? new RedisClusterConnection(name as string, config)
        : new RedisConnection(name as string, config)

    /**
     * Remove connection from the list of tracked connections
     */
    connection.on('end', ($connection) => {
      debug('%s connection closed. Removing from tracked connections list', name)
      delete this.activeConnections[$connection.connectionName]
    })

    /**
     * Cache the connection so that we can re-use it later
     */
    this.activeConnections[name] = connection as GetConnectionType<ConnectionsList, ConnectionName>
    return connection as GetConnectionType<ConnectionsList, ConnectionName>
  }

  /**
   * Quit a named connection or the default connection when no
   * name is defined.
   */
  async quit<ConnectionName extends keyof ConnectionsList>(name?: ConnectionName) {
    const connection = this.activeConnections[name || this.#config.connection]
    if (!connection) {
      return
    }

    return connection.quit()
  }

  /**
   * Disconnect a named connection or the default connection when no
   * name is defined.
   */
  async disconnect<ConnectionName extends keyof ConnectionsList>(name?: ConnectionName) {
    const connection = this.activeConnections[name || this.#config.connection]
    if (!connection) {
      return
    }

    return connection.disconnect()
  }

  /**
   * Quit all connections
   */
  async quitAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.disconnect(name)))
  }
}
