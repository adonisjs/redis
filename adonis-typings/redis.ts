/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

declare module '@ioc:Adonis/Addons/Redis' {
  import { Redis, RedisOptions, ClusterOptions } from 'ioredis'

  /**
   * Pubsub subscriber
   */
  export type PubSubChannelHandler<T extends any = any> = ((data: T) => Promise<void> | void)
  export type PubSubPatternHandler<T extends any = any> = ((channel: string, data: T) => Promise<void> | void)

  /**
   * Shape of cluster config
   */
  export type ClusterConfigContract = {
    cluster: boolean,
    clusters: { host: string, port: number }[],
    clusterOptions?: ClusterOptions,
    redisOptions?: RedisOptions,
  }

  /**
   * Shape of redis connection config
   */
  export type ConnectionConfigContract = RedisOptions

  /**
   * Redis factory interface extending the ioRedis main interface. We drop
   * the custom `Promise` support from it.
   */
  export interface RedisFactoryContract extends Omit<
    Redis, 'Promise' | 'subscribe' | 'psubscribe' | 'unsubscribe' | 'punsubscribe'
  > {
    connection: Redis
    subscriberConnection?: Redis
    subscribe (channel: string, handler: PubSubChannelHandler): void
    psubscribe (pattern: string, handler: PubSubPatternHandler): void
    unsubscribe (channel: string): void
    punsubscribe (pattern: string): void
  }

  export interface RedisClusterFactoryContract extends Redis {
  }

  export interface RedisContract<
    Config extends { [key: string]: ConnectionConfigContract | ClusterConfigContract }
  > {
    connection<K extends keyof Config> (
      name: K,
    ): Config[K] extends ClusterConfigContract ? RedisClusterFactoryContract : RedisFactoryContract
  }
}
