/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

declare module '@ioc:Adonis/Addons/Redis' {
  import { EventEmitter } from 'events'
  import { HealthReportEntry } from '@ioc:Adonis/Core/HealthCheck'
  import { Redis, RedisOptions, ClusterOptions, Cluster, NodeRole } from 'ioredis'

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */
  /**
   * Returns factory for a given connection by inspecting it's config.
   */
  type GetConnectionFactoryType<
    T extends keyof RedisConnectionsList
  > = RedisConnectionsList[T] extends RedisClusterConfig
    ? RedisClusterConnectionContract
    : RedisConnectionContract

  /*
  |--------------------------------------------------------------------------
  | PubSub
  |--------------------------------------------------------------------------
  */
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
   * Shape of the report node for the redis connection report
   */
  export type HealthReportNode = {
    connection: string,
    status: string,
    used_memory: string,
    error: any,
  }

  /**
   * List of commands on the IORedis. We omit their internal events and pub/sub
   * handlers, since we our own.
   */
  export type IORedisCommands = Omit<Redis,
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

  /*
  |--------------------------------------------------------------------------
  | Redis Connections
  |--------------------------------------------------------------------------
  */
  /**
   * Standard Redis Connection
   */
  export interface RedisConnectionContract extends IORedisCommands, RedisPubSubContract, EventEmitter {
    status: string
    connectionName: string
    subscriberStatus?: string
    ioConnection: Redis
    ioSubscriberConnection?: Redis

    connect (callback?: () => void): Promise<any>
    disconnect (): Promise<void>
    duplicate (): Redis
    getReport (checkForMemory?: boolean): Promise<HealthReportNode>
    quit (): Promise<void>
  }

  /**
   * Redis cluster factory interface
   */
  export interface RedisClusterConnectionContract extends IORedisCommands, RedisPubSubContract, EventEmitter {
    status: string
    connectionName: string,
    subscriberStatus?: string
    ioConnection: Cluster
    ioSubscriberConnection?: Cluster

    getReport (checkForMemory?: boolean): Promise<HealthReportNode>
    connect (callback?: () => void): Promise<any>
    nodes (role?: NodeRole): Redis[]
    disconnect (): Promise<void>
    duplicate (): Cluster
    quit (): Promise<void>
  }

  type Connection = RedisClusterConnectionContract | RedisConnectionContract

  /**
   * Redis manager exposes the API to intertact with a redis server. One can make
   * use of multiple redis connections by defining them inside `config/redis`
   * file.
   *
   * ```ts
   * Redis.connection() // default connection
   * Redis.connection('primary') // named connection
   * ```
   */
  export interface RedisManagerContract {
    /**
     * A boolean to know whether health checks have been enabled on one
     * or more redis connections or not.
     */
    healthChecksEnabled: boolean,

    /**
     * Number of active redis connection.
     */
    activeConnectionsCount: number,
    activeConnections: { [key: string]: Connection }

    /**
     * Fetch a named connection from the defined config inside config/redis file
     */
    connection<Connection extends keyof RedisConnectionsList> (
      name: Connection,
    ): GetConnectionFactoryType<Connection>

    /**
     * Returns the default connection client
     */
    connection (): GetConnectionFactoryType<RedisConfig['connection']>

    /**
     * Returns the healthcheck report
     */
    report (): Promise<HealthReportEntry & { meta: HealthReportNode[] }>

    /**
     * Quit a named connection.
     */
    quit<Connection extends keyof RedisConnectionsList> (name?: Connection): Promise<void>

    /**
     * Forcefully disconnect a named connection.
     */
    disconnect<Connection extends keyof RedisConnectionsList> (name?: Connection): Promise<void>

    /**
     * Quit all redis connections
     */
    quitAll (): Promise<void>

    /**
     * Disconnect all redis connections
     */
    disconnectAll (): Promise<void>
  }

  /*
  |--------------------------------------------------------------------------
  | Config
  |--------------------------------------------------------------------------
  */
  /**
   * Shape of standard Redis connection config
   */
  export type RedisConnectionConfig = Omit<RedisOptions, 'port'> & {
    healthCheck?: boolean,
    port?: string | number,
  }

  /**
   * Shape of cluster config
   */
  export type RedisClusterConfig = {
    clusters: { host: string, port: number | string }[],
    clusterOptions?: ClusterOptions,
    healthCheck?: boolean,
  }

  /**
   * A list of typed connections defined in the user land using
   * the contracts file
   */
  export interface RedisConnectionsList {
  }

  /**
   * Define the config properties on this interface and they will appear
   * everywhere.
   */
  export interface RedisConfig {
    connection: keyof RedisConnectionsList,
    connections: { [P in keyof RedisConnectionsList]: RedisConnectionsList[P] },
  }

  const Redis: RedisManagerContract
  export default Redis
}
