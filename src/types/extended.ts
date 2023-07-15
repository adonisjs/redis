/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type {
  RedisClusterConnectionContract,
  RedisConnectionContract,
  RedisService,
} from './main.js'
import { Redis } from 'ioredis'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    redis: RedisService
  }

  export interface EventsList {
    'redis:ready': { connection: RedisClusterConnectionContract | RedisConnectionContract }
    'redis:connect': { connection: RedisClusterConnectionContract | RedisConnectionContract }
    'redis:error': {
      error: any
      connection: RedisClusterConnectionContract | RedisConnectionContract
    }
    'redis:end': { connection: RedisClusterConnectionContract | RedisConnectionContract }

    'redis:node:added': { connection: RedisClusterConnectionContract; node: Redis }
    'redis:node:removed': { connection: RedisClusterConnectionContract; node: Redis }
    'redis:node:error': { error: any; connection: RedisClusterConnectionContract; address: string }
  }
}
