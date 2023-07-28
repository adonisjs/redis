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
import { ioMethods } from './io_methods.js'
import { AbstractConnection } from './abstract_connection.js'
import type { IORedisCommands, RedisClusterConnectionConfig } from '../types/main.js'

/**
 * Redis cluster connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing multiple
 * pub/sub connections by hand, since it handles that internally by itself.
 */
export class RedisClusterConnection extends AbstractConnection<Cluster> {
  #config: RedisClusterConnectionConfig

  constructor(connectionName: string, config: RedisClusterConnectionConfig) {
    debug('creating cluster connection %s: %O', connectionName, config)
    super(connectionName)

    this.#config = config
    this.ioConnection = new Redis.Cluster(
      this.#config.clusters as any[],
      this.#config.clusterOptions
    )
    this.monitorConnection()
  }

  /**
   * Creates the subscriber connection, the [[AbstractConnection]] will
   * invoke this method when first subscription is created.
   */
  protected makeSubscriberConnection() {
    debug('creating subscriber connection')
    this.ioSubscriberConnection = new Redis.Cluster(
      this.#config.clusters as [],
      this.#config.clusterOptions
    )
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
export interface RedisClusterConnection extends IORedisCommands {}
ioMethods.forEach((method) => {
  ;(RedisClusterConnection.prototype as any)[method] = function redisConnectionProxyFn(
    ...args: any[]
  ) {
    return this.ioConnection[method](...args)
  }
})

export default RedisClusterConnection
