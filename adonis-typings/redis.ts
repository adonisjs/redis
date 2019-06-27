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
   * List of connections from the config interface by excluding the
   * connection property.
   */
  type ConnectionsList = Exclude<keyof RedisConfigContract, 'connection'>

  /**
   * Returns factory for a given connection by inspecting it's config.
   */
  type GetFactory<T extends ConnectionsList> = RedisConfigContract[T] extends ClusterConfigContract
    ? RedisClusterFactoryContract
    : RedisFactoryContract

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
    'punsubscribe' |
    'quit'
  >

  /**
   * Redis factory interface
   */
  export interface RedisFactoryContract extends RedisCommandsContract, RedisPubSubContract {
    status: string
    connectionName: string,
    subscriberStatus?: string
    ioConnection: Redis
    ioSubscriberConnection?: Redis
    connect (callback?: () => void): Promise<any>
    disconnect (): void
    duplicate (): Redis
    quit (): Promise<void>
  }

  /**
   * Redis cluster factory interface
   */
  export interface RedisClusterFactoryContract extends RedisCommandsContract, RedisPubSubContract {
    status: string
    connectionName: string,
    subscriberStatus?: string
    ioConnection: Cluster
    ioSubscriberConnection?: Cluster
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
    connection: ConnectionsList,
  }

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
  export interface RedisContract extends Omit<
    GetFactory<RedisConfigContract['connection']>,
    'status' |
    'connectionName' |
    'subscriberStatus' |
    'ioConnection' |
    'ioSubscriberConnection' |
    'duplicate' |
    'disconnect' |
    'quit'
  > {

    /**
     * Fetch a named connection from the defined config inside config/redis file
     */
    connection<Connection extends ConnectionsList> (name: Connection): GetFactory<Connection>

    /**
     * Fetch a named connection from the defined config inside config/redis file
     */
    connection (name: string): RedisFactoryContract | RedisClusterFactoryContract

    /**
     * Returns the default connection client
     */
    connection (): GetFactory<RedisConfigContract['connection']>

    /**
     * Quit a named connection.
     */
    quit<Connection extends ConnectionsList> (name: Connection): Promise<void>
    quit (name?: string): Promise<void>

    /**
     * Forcefully disconnect a named connection.
     */
    disconnect<Connection extends ConnectionsList> (name: Connection): Promise<void>
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
