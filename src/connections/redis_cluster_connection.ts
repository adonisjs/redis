/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Redis, { type Cluster, type NodeRole } from 'ioredis'

import debug from '../debug.js'
import { baseMethods } from './io_methods.js'
import { AbstractConnection } from './abstract_connection.js'
import type {
  ConnectionEvents,
  IORedisBaseCommands,
  RedisClusterConnectionConfig,
} from '../types.js'

/**
 * Redis cluster connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing multiple
 * pub/sub connections by hand, since it handles that internally by itself.
 */
export class RedisClusterConnection extends AbstractConnection<
  Cluster,
  ConnectionEvents<RedisClusterConnection>
> {
  #hosts: RedisClusterConnectionConfig['clusters']
  #config: RedisClusterConnectionConfig['clusterOptions']

  get slots() {
    return this.ioConnection.slots
  }

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
    this.monitorConnection()
  }

  /**
   * Creates the subscriber connection, the [[AbstractConnection]] will
   * invoke this method when first subscription is created.
   */
  protected makeSubscriberConnection() {
    debug('creating subscriber connection')
    this.ioSubscriberConnection = new Redis.Cluster(this.#hosts as any[], this.#config)
    this.monitorSubscriberConnection()
  }

  /**
   * Returns cluster nodes
   */
  nodes(role?: NodeRole) {
    return this.ioConnection.nodes(role)
  }
}

/**
 * Adding IORedis methods dynamically on the RedisClusterConnection
 * class and also extending its TypeScript types
 */
export interface RedisClusterConnection extends IORedisBaseCommands {}
baseMethods.forEach((method) => {
  ;(RedisClusterConnection.prototype as any)[method] = function redisConnectionProxyFn(
    ...args: any[]
  ) {
    return this.ioConnection[method](...args)
  }
})

export default RedisClusterConnection
