/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Redis, Cluster, RedisOptions, ClusterOptions } from 'ioredis'

import type RedisManager from '../redis_manager.js'
import type { baseMethods, redisMethods } from '../connections/io_methods.js'
import type RedisConnection from '../connections/redis_connection.js'
import type RedisClusterConnection from '../connections/redis_cluster_connection.js'

/**
 * PubSub subscriber
 */
export type PubSubChannelHandler<T extends any = string> = (data: T) => Promise<void> | void
export type PubSubPatternHandler<T extends any = string> = (
  channel: string,
  data: T
) => Promise<void> | void

/**
 * Options accepted during subscribe
 */
export type PubSubOptions = {
  onError(error: any): void
  onSubscription(count: number): void
}

/**
 * List of connection events
 */
export type ConnectionEvents<T extends any> = {
  'connect': { connection: T }
  'wait': { connection: T }
  'ready': { connection: T }
  'error': { error: any; connection: T }
  'close': { connection: T }
  'reconnecting': { connection: T; waitTime: number }
  'end': { connection: T }
  'subscriber:connect': { connection: T }
  'subscriber:ready': { connection: T }
  'subscriber:error': { error: any; connection: T }
  'subscriber:close': { connection: T }
  'subscriber:reconnecting': { connection: T; waitTime: number }
  'subscriber:end': { connection: T }
  'node:added': { connection: T; node: Redis }
  'node:removed': { connection: T; node: Redis }
  'node:error': { error: any; address: string; connection: T }
  'subscription:ready': { connection: T; count: number }
  'subscription:error': { connection: T; error: any }
  'psubscription:ready': { connection: T; count: number }
  'psubscription:error': { connection: T; error: any }
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
 * handlers, since we have our own.
 */
export type IORedisBaseCommands = {
  [K in (typeof baseMethods)[number]]: Cluster[K]
}
export type IORedisConnectionCommands = {
  [K in (typeof redisMethods)[number]]: Redis[K]
}

/**
 * Configuration accepted by the redis connection. It is same
 * as ioredis, except the number can be a string as well
 */
export type RedisConnectionConfig = Omit<RedisOptions, 'port'> & {
  port?: string | number
}

/**
 * Configuration accepted by the RedisClusterConnectionConfig.
 */
export type RedisClusterConnectionConfig = {
  clusters: { host: string; port: number | string }[]
  clusterOptions?: ClusterOptions
  healthCheck?: boolean
}

/**
 * A connection can be a cluster or a single connection
 */
export type Connection = RedisClusterConnection | RedisConnection

/**
 * A list of multiple connections defined inside the user
 * config file
 */
export type RedisConnectionsList = Record<
  string,
  RedisConnectionConfig | RedisClusterConnectionConfig
>

/**
 * Returns the connection class to be used based upon the config
 */
export type GetConnectionType<
  ConnectionsList extends RedisConnectionsList,
  T extends keyof ConnectionsList,
> = ConnectionsList[T] extends RedisClusterConnectionConfig
  ? RedisClusterConnection
  : RedisConnection

/**
 * List of connections inferred from user config
 */
export interface RedisConnections {}
export type InferConnections<T extends { connections: RedisConnectionsList }> = T['connections']

/**
 * Redis service is a singleton redis instance registered
 * with the container based upon user defined config
 */
export interface RedisService
  extends RedisManager<RedisConnections extends RedisConnectionsList ? RedisConnections : never> {}
