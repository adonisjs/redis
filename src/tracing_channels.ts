/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import diagnostics_channel from 'node:diagnostics_channel'
import { type RedisCommandData } from './types.ts'

/**
 * Traces every Redis command sent by IORedis
 */
export const redisCommand = diagnostics_channel.tracingChannel<
  'adonisjs.redis.command',
  RedisCommandData
>('adonisjs.redis.command')
