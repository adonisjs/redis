/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type {
  RedisClusterConnectionAugmented,
  RedisConnectionAugmented,
  RedisManagerAugmented,
} from './main.js'
import { Redis } from 'ioredis'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    redis: RedisManagerAugmented
  }

  export interface EventsList {
    'redis:ready': { connection: RedisClusterConnectionAugmented | RedisConnectionAugmented }
    'redis:connect': { connection: RedisClusterConnectionAugmented | RedisConnectionAugmented }
    'redis:error': {
      error: any
      connection: RedisClusterConnectionAugmented | RedisConnectionAugmented
    }
    'redis:end': { connection: RedisClusterConnectionAugmented | RedisConnectionAugmented }

    'redis:node:added': { connection: RedisClusterConnectionAugmented; node: Redis }
    'redis:node:removed': { connection: RedisClusterConnectionAugmented; node: Redis }
    'redis:node:error': { error: any; connection: RedisClusterConnectionAugmented; address: string }
  }
}
