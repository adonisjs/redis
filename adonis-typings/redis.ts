/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

declare module '@ioc:Adonis/Addons/Redis' {
  import Emittery from 'emittery'
  import { EventEmitter } from 'events'
  import { Redis, RedisOptions, ClusterOptions, Cluster, NodeRole } from 'ioredis'

  /**
   * List of connections from the config interface by excluding the
   * connection property.
   */
  export interface RedisConnectionsList {
  }

  /**
   * Returns factory for a given connection by inspecting it's config.
   */
  type GetFactory<T extends keyof RedisConnectionsList> = RedisConnectionsList[T] extends ClusterConfigContract
    ? RedisClusterFactoryContract
    : RedisFactoryContract

  /**
   * Shape of the report node for the redis connection report
   */
  export type ReportNode = {
    connection: string,
    status: string,
    used_memory: string,
    error: any,
  }

  /**
   * Pubsub subscriber
   */
  export type PubSubChannelHandler<T extends any = any> = ((data: T) => Promise<void> | void)
  export type PubSubPatternHandler<T extends any = any> = ((channel: string, data: T) => Promise<void> | void)

  /**
   * Redis pub/sub methods
   */
  export interface RedisPubSubContract {
    subscribe (channel: string, handler: PubSubChannelHandler | string): void
    psubscribe (pattern: string, handler: PubSubPatternHandler | string): void
    unsubscribe (channel: string): void
    punsubscribe (pattern: string): void
  }

  /**
   * Shape of cluster config
   */
  export type ClusterConfigContract = {
    clusters: { host: string, port: number | string }[],
    clusterOptions?: ClusterOptions,
    healthCheck?: boolean,
  }

  /**
   * Shape of redis connection config
   */
  export type ConnectionConfigContract = Omit<RedisOptions, 'port'> & {
    healthCheck?: boolean,
    port?: string | number,
  }

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
  'punsubscribe' |
  'quit' |
  keyof EventEmitter
  >

  /**
   * List of typed events emitted by the redis factory
   */
  export interface RedisEventsList<T extends Factory> {
    connect: [T],
    ready: [T],
    error: [T, any],
    close: [T],
    reconnecting: [T],
    end: [T],

    'subscriber:connect': [T],
    'subscriber:ready': [T],
    'subscriber:error': [T, any],
    'subscriber:close': [T],
    'subscriber:reconnecting': [T],
    'subscriber:end': [T],

    'subscription:error': [T, any],
    'subscription:ready': [T, number],

    'psubscription:error': [T, any],
    'psubscription:ready': [T, number],
  }

  /**
   * List of typed events emitted by the redis cluster factory
   */
  export interface RedisClusterEventsList<T extends Factory> extends RedisEventsList<T> {
    'node:added': [T, Redis],
    'node:removed': [T, Redis],
    'node:error': [T, any, string],
  }

  /**
   * Redis factory interface
   */
  export interface RedisFactoryContract extends RedisCommandsContract, RedisPubSubContract, Emittery.Typed<
  RedisEventsList<RedisFactoryContract>
  > {
    status: string
    connectionName: string,
    subscriberStatus?: string
    ioConnection: Redis
    ioSubscriberConnection?: Redis
    connect (callback?: () => void): Promise<any>
    disconnect (): void
    duplicate (): Redis
    getReport (checkForMemory?: boolean): Promise<ReportNode>
    quit (): Promise<void>
  }

  /**
   * Redis cluster factory interface
   */
  export interface RedisClusterFactoryContract extends RedisCommandsContract, RedisPubSubContract, Emittery.Typed<
  RedisClusterEventsList<RedisClusterFactoryContract>
  > {
    status: string
    connectionName: string,
    subscriberStatus?: string
    ioConnection: Cluster
    ioSubscriberConnection?: Cluster
    getReport (checkForMemory?: boolean): Promise<ReportNode>
    connect (callback?: () => void): Promise<any>
    nodes (role?: NodeRole): Redis[]
    disconnect (): void
    duplicate (): Cluster
    quit (): Promise<void>
  }

  /**
   * Define the config properties on this interface and they will appear
   * everywhere.
   */
  export interface RedisConfigContract {
    connection: keyof RedisConnectionsList,
    connections: { [P in keyof RedisConnectionsList]: RedisConnectionsList[P] },
  }

  type Factory = RedisFactoryContract | RedisClusterFactoryContract

  /**
   * Redis class exposes the API to intertact with a redis server. You can make
   * use of multiple redis connections by defining them inside `config/redis`
   * file.
   *
   * ```ts
   * Redis.connection() // default connection
   * Redis.connection('primary') // named connection
   *
   * Redis.get('some-key') // runs on default connection
   * ```
   */
  export interface RedisContract extends Emittery.Typed<RedisClusterEventsList<Factory>> {
    /**
     * A boolean to know whether health checks have been enabled on one
     * or more redis connections or not.
     */
    healthChecksEnabled: boolean,

    /**
     * Fetch a named connection from the defined config inside config/redis file
     */
    connection<Connection extends keyof RedisConnectionsList> (name: Connection): GetFactory<Connection>

    /**
     * Fetch a named connection from the defined config inside config/redis file
     */
    connection (name: string): RedisFactoryContract | RedisClusterFactoryContract

    /**
     * Returns the default connection client
     */
    connection (): GetFactory<RedisConfigContract['connection']>

    /**
     * Returns the healthcheck report
     */
    report (): Promise<{ health: { healthy: boolean, message: string }, meta: ReportNode[] }>

    /**
     * Quit a named connection.
     */
    quit<Connection extends keyof RedisConnectionsList> (name: Connection): Promise<void>
    quit (name?: string): Promise<void>

    /**
     * Forcefully disconnect a named connection.
     */
    disconnect<Connection extends keyof RedisConnectionsList> (name: Connection): Promise<void>
    disconnect (name?: string): Promise<void>

    /**
     * Quit all redis connections
     */
    quitAll (): Promise<void>

    /**
     * Disconnect all redis connections
     */
    disconnectAll (): Promise<void>
  }

  const Redis: RedisContract
  export default Redis
}
