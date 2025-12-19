/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Redis, { type Cluster, type NodeRole } from 'ioredis'

import debug from '../debug.ts'
import { baseMethods } from './io_methods.ts'
import { redisCommand } from '../tracing_channels.ts'
import { AbstractConnection } from './abstract_connection.ts'
import type {
  ConnectionEvents,
  IORedisBaseCommands,
  RedisClusterConnectionConfig,
} from '../types.ts'

/**
 * Redis cluster connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing multiple
 * pub/sub connections by hand, since it handles that internally by itself.
 *
 * @example
 * ```ts
 * const cluster = new RedisClusterConnection('cluster', [
 *   { host: '127.0.0.1', port: 7000 },
 *   { host: '127.0.0.1', port: 7001 }
 * ], { enableOfflineQueue: false })
 *
 * await cluster.set('key', 'value')
 * const value = await cluster.get('key')
 * ```
 */
export class RedisClusterConnection extends AbstractConnection<
  Cluster,
  ConnectionEvents<RedisClusterConnection>
> {
  /**
   * Array of cluster host configurations
   */
  #hosts: RedisClusterConnectionConfig['clusters']

  /**
   * Redis cluster configuration options
   */
  #config: RedisClusterConnectionConfig['clusterOptions']

  /**
   * Returns the cluster slots configuration
   */
  get slots() {
    return this.ioConnection.slots
  }

  /**
   * Create a new Redis cluster connection
   *
   * @param connectionName - Unique name for this connection
   * @param hosts - Array of cluster node configurations
   * @param config - Redis cluster configuration options
   *
   * @example
   * ```ts
   * const connection = new RedisClusterConnection(
   *   'main-cluster',
   *   [{ host: '127.0.0.1', port: 7000 }],
   *   { enableOfflineQueue: false }
   * )
   * ```
   */
  constructor(
    connectionName: string,
    hosts: RedisClusterConnectionConfig['clusters'],
    config: RedisClusterConnectionConfig['clusterOptions']
  ) {
    debug('creating cluster connection %s: %O', connectionName, config)
    super(connectionName)

    this.#hosts = hosts
    this.#config = config

    this.ioConnection = new Redis.Cluster(this.#hosts as any[], this.#config)
    const originalSendCommand = this.ioConnection.sendCommand

    this.ioConnection.sendCommand = function (command, ...args) {
      return redisCommand.tracePromise(
        originalSendCommand as (...args: Parameters<Redis.Cluster['sendCommand']>) => Promise<any>,
        redisCommand.hasSubscribers ? { command } : undefined,
        this,
        command,
        ...args
      )
    }

    this.monitorConnection()
  }

  /**
   * Creates the subscriber connection, the AbstractConnection will
   * invoke this method when first subscription is created.
   */
  protected makeSubscriberConnection() {
    debug('creating subscriber connection')
    this.ioSubscriberConnection = new Redis.Cluster(this.#hosts as any[], this.#config)
    this.monitorSubscriberConnection()
  }

  /**
   * Returns cluster nodes
   *
   * @param role - Optional role filter ('master', 'slave', or 'all')
   *
   * @example
   * ```ts
   * // Get all nodes
   * const allNodes = cluster.nodes()
   *
   * // Get only master nodes
   * const masterNodes = cluster.nodes('master')
   * ```
   */
  nodes(role?: NodeRole) {
    return this.ioConnection.nodes(role)
  }
}

export interface RedisClusterConnection extends IORedisBaseCommands {}
baseMethods.forEach((method) => {
  ;(RedisClusterConnection.prototype as any)[method] = function redisConnectionProxyFn(
    ...args: any[]
  ) {
    return this.ioConnection[method](...args)
  }
})

export default RedisClusterConnection
