/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

declare module '@ioc:Adonis/Addons/Redis' {
  import { Redis, RedisOptions, ClusterOptions, Cluster, NodeRole } from 'ioredis'

  /**
   * Pubsub subscriber
   */
  export type PubSubChannelHandler<T extends any = any> = ((data: T) => Promise<void> | void)
  export type PubSubPatternHandler<T extends any = any> = ((channel: string, data: T) => Promise<void> | void)

  /**
   * Redis pub/sub methods
   */
  export interface RedisPubSubContract {
    subscribe (channel: string, handler: PubSubChannelHandler): void
    psubscribe (pattern: string, handler: PubSubPatternHandler): void
    unsubscribe (channel: string): void
    punsubscribe (pattern: string): void
  }

  /**
   * Shape of cluster config
   */
  export type ClusterConfigContract = {
    cluster: boolean,
    clusters: { host: string, port: number }[],
    clusterOptions?: ClusterOptions,
  }

  /**
   * Shape of redis connection config
   */
  export type ConnectionConfigContract = RedisOptions

  /**
   * We extract the list of commands from the Redis, since we
   * need it for cluster too.
   */
  export type RedisCommandsContract = Omit<Redis,
    'Promise' |
    'status' |
    'connect' |
    'disconnect' |
    'duplicate' |
    'subscribe' |
    'unsubscribe' |
    'psubscribe' |
    'punsubscribe'
  >

  /**
   * Redis factory interface
   */
  export interface RedisFactoryContract extends RedisCommandsContract, RedisPubSubContract {
    status: string
    connection: Redis
    subscriberConnection?: Redis
    connect (callback?: () => void): Promise<any>
    disconnect (): void
    duplicate (): Redis
  }

  /**
   * Redis cluster factory interface
   */
  export interface RedisClusterFactoryContract extends RedisCommandsContract, RedisPubSubContract {
    status: string
    connection: Cluster
    subscriberConnection?: Cluster
    connect (callback?: () => void): Promise<any>
    nodes (role?: NodeRole): Redis[]
    disconnect (): void
    duplicate (): Cluster
  }
}
