/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { EventEmitter } from 'node:events'
import { Redis as IoRedis, RedisOptions, ClusterOptions, Cluster } from 'ioredis'
import { RawRedisClusterConnection } from '../redis_cluster_connection.js'
import { AbstractConnection } from '../abstract_connection.js'
import { RawRedisConnection } from '../redis_connection.js'
import { Emitter } from '@adonisjs/core/events'
import { RawRedisManager } from '../redis_manager.js'

/**
 * Pubsub subscriber
 */
export type PubSubChannelHandler<T extends any = string> = (data: T) => Promise<void> | void
export type PubSubPatternHandler<T extends any = string> = (
  channel: string,
  data: T
) => Promise<void> | void

/**
 * Redis pub/sub methods
 */
export interface RedisPubSubContract {
  publish(
    channel: string,
    message: string,
    callback: (error: Error | null, count: number) => void
  ): void
  publish(channel: string, message: string): Promise<number>
  subscribe(channel: string, handler: PubSubChannelHandler | string): void
  psubscribe(pattern: string, handler: PubSubPatternHandler | string): void
  unsubscribe(channel: string): void
  punsubscribe(pattern: string): void
}

/**
 * Shape of the report node for the redis connection report
 */
export type HealthReportNode = {
  connection: string
  status: string
  used_memory: string | null
  error: any
}

/**
 * List of commands on the IORedis. We omit their internal events and pub/sub
 * handlers, since we our own.
 */
export type IORedisCommands = Omit<
  IoRedis,
  | 'Promise'
  | 'status'
  | 'connect'
  | 'disconnect'
  | 'duplicate'
  | 'subscribe'
  | 'unsubscribe'
  | 'psubscribe'
  | 'punsubscribe'
  | 'quit'
  | 'publish'
  | keyof EventEmitter
>

/**
 * A connection. Can be a cluster or a single connection
 */
export type Connection = RedisClusterConnectionContract | RedisConnectionContract

/**
 * Shape of the connections list
 */
export type RedisConnectionsList = Record<string, RedisConnectionConfig | RedisClusterConfig>

/**
 * Extract the connection type ( either Cluster or single ) from
 * a given RedisConnectionsList
 */
export type GetConnectionType<
  ConnectionsList extends RedisConnectionsList,
  T extends keyof ConnectionsList,
> = ConnectionsList[T] extends RedisClusterConfig
  ? RedisClusterConnectionContract
  : RedisConnectionContract

/**
 * Shape of standard Redis connection config
 */
export type RedisConnectionConfig = Omit<RedisOptions, 'port'> & {
  healthCheck?: boolean
  port?: string | number
}

/**
 * Shape of cluster config
 */
export type RedisClusterConfig = {
  clusters: { host: string; port: number | string }[]
  clusterOptions?: ClusterOptions
  healthCheck?: boolean
}

/**
 * Since we are dynamically addind methods to the RedisClusterConnection
 * RedisConnection and RedisManager classes prototypes, we need to tell
 * typescript about it. So the below types represents theses classes with
 * all the methods added
 */

/**
 * Type of RedisClusterConnection with dynamically added methods
 */
export type RedisClusterConnectionContract = RawRedisClusterConnection &
  AbstractConnection<Cluster> &
  IORedisCommands &
  RedisPubSubContract

/**
 * Type of RedisConnection with dynamically added methods
 */
export type RedisConnectionContract = RawRedisConnection &
  AbstractConnection<IoRedis> &
  IORedisCommands &
  RedisPubSubContract

/**
 * Type of RedisManager with dynamically added methods
 */
export type RedisManagerContract<ConnectionList extends RedisConnectionsList> =
  RawRedisManager<ConnectionList> & IORedisCommands & RedisPubSubContract

/**
 * Factory for creating RedisClusterConnection
 */
export type RedisClusterConnectionFactory = {
  new (connectionName: string, config: RedisClusterConfig): RedisClusterConnectionContract
}

/**
 * Factory for creating RedisConnection
 */
export type RedisConnectionFactory = {
  new (connectionName: string, config: RedisConnectionConfig): RedisConnectionContract
}

/**
 * Factory for creating RedisManager
 */
export type RedisManagerFactory = {
  new <ConnectionList extends RedisConnectionsList>(
    config: { connection: keyof ConnectionList; connections: ConnectionList },
    emitter: Emitter<any>
  ): RedisManagerContract<ConnectionList>
}
