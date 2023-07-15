/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Redis, { Cluster, NodeRole } from 'ioredis'

import { ioMethods } from './io_methods.js'
import { AbstractConnection } from './abstract_connection.js'
import { ApplicationService } from '@adonisjs/core/types'
import { RedisClusterConfig, RedisClusterConnectionFactory } from './types/main.js'

/**
 * Redis cluster connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing multiple
 * pub/sub connections by hand, since it handles that internally by itself.
 */
export class RawRedisClusterConnection extends AbstractConnection<Cluster> {
  #config: RedisClusterConfig

  constructor(connectionName: string, config: RedisClusterConfig, application: ApplicationService) {
    super(connectionName, application)

    this.#config = config
    this.ioConnection = new Redis.Cluster(this.#config.clusters as any[])
    this.proxyConnectionEvents()
  }

  /**
   * Creates the subscriber connection, the [[AbstractConnection]] will
   * invoke this method when first subscription is created.
   */
  protected makeSubscriberConnection() {
    this.ioSubscriberConnection = new Redis.Cluster(
      this.#config.clusters as [],
      this.#config.clusterOptions
    )
  }

  /**
   * Returns cluster nodes
   */
  nodes(role?: NodeRole) {
    return this.ioConnection.nodes(role)
  }
}

/**
 * Here we attach pubsub and ioRedis methods to the class.
 *
 * But we also need to inform typescript about the existence of
 * these methods. So we are exporting the class with a
 * casted type that has these methods.
 */
const RedisClusterConnection = RawRedisClusterConnection as unknown as RedisClusterConnectionFactory

ioMethods.forEach((method) => {
  RedisClusterConnection.prototype[method] = function redisConnectionProxyFn(...args: any[]) {
    return this.ioConnection[method](...args)
  }
})

export default RedisClusterConnection
