/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RedisConnectionConfig, RedisClusterConfig } from '@ioc:Adonis/Addons/Redis'

/**
 * Expected shape of the config accepted by the "redisConfig"
 * method
 */
type RedisConfig = {
  connections: {
    [name: string]: RedisConnectionConfig | RedisClusterConfig
  }
}

/**
 * Define config for redis
 */
export function redisConfig<T extends RedisConfig & { connection: keyof T['connections'] }>(
  config: T
): T {
  return config
}

/**
 * Pull connections from the config defined inside the "config/redis.ts"
 * file
 */
export type InferConnectionsFromConfig<T extends RedisConfig> = {
  [K in keyof T['connections']]: T['connections'][K]
}
