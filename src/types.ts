/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Secret } from '@adonisjs/core/helpers'
import { type AsyncOrSync } from '@poppinss/utils/types'
import type { Redis, Cluster, RedisOptions, ClusterOptions, Command } from 'ioredis'

import type RedisManager from './redis_manager.ts'
import type RedisConnection from './connections/redis_connection.ts'
import type { baseMethods, redisMethods } from './connections/io_methods.ts'
import type RedisClusterConnection from './connections/redis_cluster_connection.ts'

export type RedisCommandData = {
  command: Command
}

/**
 * PubSub channel message handler function
 *
 * @template T - Type of the message data, defaults to string
 *
 * @example
 * ```ts
 * const handler: PubSubChannelHandler = (message) => {
 *   console.log('Received message:', message)
 * }
 *
 * // With typed messages
 * const typedHandler: PubSubChannelHandler<{ id: number }> = (data) => {
 *   console.log('User ID:', data.id)
 * }
 * ```
 */
export type PubSubChannelHandler<T extends any = string> = (data: T) => AsyncOrSync<void>

/**
 * PubSub pattern message handler function
 *
 * @template T - Type of the message data, defaults to string
 *
 * @example
 * ```ts
 * const handler: PubSubPatternHandler = (channel, message) => {
 *   console.log(`Message from ${channel}:`, message)
 * }
 * ```
 */
export type PubSubPatternHandler<T extends any = string> = (
  channel: string,
  data: T
) => AsyncOrSync<void>

/**
 * Options accepted during subscribe operations
 *
 * @example
 * ```ts
 * const options: PubSubOptions = {
 *   onError: (error) => {
 *     console.error('Subscription error:', error)
 *   },
 *   onSubscription: (count) => {
 *     console.log('Subscribed to', count, 'channels')
 *   }
 * }
 *
 * connection.subscribe('notifications', handler, options)
 * ```
 */
export type PubSubOptions = {
  /** Called when a subscription error occurs */
  onError(error: any): void
  /** Called when subscription is successfully established */
  onSubscription(count: number): void
}

/**
 * List of connection events emitted by Redis connections
 *
 * @template T - The connection type (RedisConnection or RedisClusterConnection)
 *
 * @example
 * ```ts
 * connection.on('ready', ({ connection }) => {
 *   console.log('Redis connection ready')
 * })
 *
 * connection.on('error', ({ error, connection }) => {
 *   console.error('Redis connection error:', error)
 * })
 * ```
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
 * Base Redis commands available on both cluster and standalone connections.
 * These are mapped from IORedis cluster commands, excluding internal events and pub/sub handlers.
 *
 * @example
 * ```ts
 * // These commands are available on both connection types
 * await connection.set('key', 'value')
 * const value = await connection.get('key')
 * ```
 */
export type IORedisBaseCommands = {
  [K in (typeof baseMethods)[number]]: Cluster[K]
}

/**
 * Redis commands available only on standalone (non-cluster) connections.
 * Includes all base commands plus additional standalone-specific methods.
 *
 * @example
 * ```ts
 * // Additional commands available on standalone connections
 * await connection.monitor()
 * const stream = connection.scanStream()
 * ```
 */
export type IORedisConnectionCommands = {
  [K in (typeof redisMethods)[number]]: Redis[K]
}

/**
 * Configuration for a standalone Redis connection.
 * Extends IORedis RedisOptions but allows port to be string and passwords to use Secret class.
 *
 * @example
 * ```ts
 * const config: RedisConnectionConfig = {
 *   host: 'localhost',
 *   port: '6379', // Can be string or number
 *   password: Secret.create('my-password'),
 *   db: 0,
 *   retryDelayOnFailover: 100
 * }
 * ```
 */
export type RedisConnectionConfig = Omit<RedisOptions, 'port' | 'password' | 'sentinelPassword'> & {
  /** Redis server port (can be string or number) */
  port?: string | number
  /** Redis password (can be string or Secret) */
  password?: string | Secret<string>
  /** Sentinel password (can be string or Secret) */
  sentinelPassword?: string | Secret<string>
}

/**
 * Configuration for a Redis cluster connection.
 *
 * @example
 * ```ts
 * const config: RedisClusterConnectionConfig = {
 *   clusters: [
 *     { host: '127.0.0.1', port: 7000 },
 *     { host: '127.0.0.1', port: 7001 },
 *     { host: '127.0.0.1', port: 7002 }
 *   ],
 *   clusterOptions: {
 *     enableOfflineQueue: false,
 *     maxRetriesPerRequest: 3
 *   }
 * }
 * ```
 */
export type RedisClusterConnectionConfig = {
  /** Array of cluster node configurations */
  clusters: { host: string; port: number | string }[]
  /** Optional cluster-specific options */
  clusterOptions?: ClusterOptions
}

/**
 * Union type representing either a cluster or standalone Redis connection
 *
 * @example
 * ```ts
 * function handleConnection(connection: Connection) {
 *   if ('nodes' in connection) {
 *     // It's a cluster connection
 *     const nodes = connection.nodes('master')
 *   } else {
 *     // It's a standalone connection
 *     await connection.monitor()
 *   }
 * }
 * ```
 */
export type Connection = RedisClusterConnection | RedisConnection

/**
 * Record of multiple Redis connections defined in the user configuration.
 * Keys are connection names, values are either standalone or cluster configurations.
 *
 * @example
 * ```ts
 * const connections: RedisConnectionsList = {
 *   main: {
 *     host: 'localhost',
 *     port: 6379
 *   },
 *   cache: {
 *     host: 'cache.redis.com',
 *     port: 6380
 *   },
 *   cluster: {
 *     clusters: [
 *       { host: '127.0.0.1', port: 7000 },
 *       { host: '127.0.0.1', port: 7001 }
 *     ]
 *   }
 * }
 * ```
 */
export type RedisConnectionsList = Record<
  string,
  RedisConnectionConfig | RedisClusterConnectionConfig
>

/**
 * Utility type that determines the correct connection class based on configuration.
 * Returns RedisClusterConnection for cluster configs, RedisConnection for standalone configs.
 *
 * @template ConnectionsList - The connections list type
 * @template T - The connection name key
 *
 * @example
 * ```ts
 * type MyConnections = {
 *   main: RedisConnectionConfig
 *   cluster: RedisClusterConnectionConfig
 * }
 *
 * type MainConnection = GetConnectionType<MyConnections, 'main'> // RedisConnection
 * type ClusterConnection = GetConnectionType<MyConnections, 'cluster'> // RedisClusterConnection
 * ```
 */
export type GetConnectionType<
  ConnectionsList extends RedisConnectionsList,
  T extends keyof ConnectionsList,
> = ConnectionsList[T] extends RedisClusterConnectionConfig
  ? RedisClusterConnection
  : RedisConnection

/**
 * Interface for defining available Redis connections.
 * This is augmented by users to provide type-safe connection access.
 *
 * @example
 * ```ts
 * declare module '@adonisjs/redis/types' {
 *   interface RedisConnections {
 *     main: RedisConnectionConfig
 *     cache: RedisConnectionConfig
 *     cluster: RedisClusterConnectionConfig
 *   }
 * }
 * ```
 */
export interface RedisConnections {}

/**
 * Utility type to infer connection types from a configuration object.
 *
 * @template T - Configuration object with connections property
 *
 * @example
 * ```ts
 * const config = {
 *   connections: {
 *     main: { host: 'localhost', port: 6379 },
 *     cache: { host: 'cache', port: 6380 }
 *   }
 * }
 *
 * type Connections = InferConnections<typeof config> // { main: {...}, cache: {...} }
 * ```
 */
export type InferConnections<T extends { connections: RedisConnectionsList }> = T['connections']

/**
 * Redis service interface representing the singleton Redis instance registered with the IoC container.
 * Extends RedisManager with the user-defined connections from module augmentation.
 *
 * @example
 * ```ts
 * // In your application
 * const redis = await app.container.make('redis')
 *
 * // Type-safe connection access
 * const mainConnection = redis.connection('main')
 * const cacheConnection = redis.connection('cache')
 *
 * // Direct Redis operations on default connection
 * await redis.set('key', 'value')
 * const value = await redis.get('key')
 * ```
 */
export interface RedisService
  extends RedisManager<RedisConnections extends RedisConnectionsList ? RedisConnections : never> {}
