/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { RedisClientType } from 'redis'

/**
 * The subset of node-redis commands proxied by the "NodeRedisConnection"
 * class. Unlike the ioredis "baseMethods" list (which enumerates the
 * complete ioredis surface), this list is intentionally partial: it
 * exists to prove the design, not to reach feature parity.
 *
 * Commands are named using node-redis conventions (camelCase), since
 * node-redis has no ioredis compatible aliases.
 *
 * Any command that is not part of this list can still be executed by
 * grabbing the underlying client using "await connection.connect()".
 *
 * @example
 * ```ts
 * nodeRedisMethods.forEach((method) => {
 *   ConnectionClass.prototype[method] = async function (...args) {
 *     const client = await this.connect()
 *     return client[method](...args)
 *   }
 * })
 * ```
 */
export const nodeRedisMethods = [
  /**
   * Strings
   */
  'append',
  'decr',
  'decrBy',
  'get',
  'getDel',
  'getEx',
  'getSet',
  'incr',
  'incrBy',
  'incrByFloat',
  'mGet',
  'mSet',
  'set',
  'setEx',
  'setNX',
  'strLen',

  /**
   * Keys
   */
  'copy',
  'del',
  'exists',
  'expire',
  'expireAt',
  'keys',
  'persist',
  'pTTL',
  'randomKey',
  'rename',
  'scan',
  'ttl',
  'type',
  'unlink',

  /**
   * Hashes
   */
  'hDel',
  'hExists',
  'hGet',
  'hGetAll',
  'hIncrBy',
  'hKeys',
  'hLen',
  'hSet',
  'hVals',

  /**
   * Lists
   */
  'lLen',
  'lPop',
  'lPush',
  'lRange',
  'lRem',
  'rPop',
  'rPush',

  /**
   * Sets
   */
  'sAdd',
  'sCard',
  'sIsMember',
  'sMembers',
  'sRem',

  /**
   * Sorted sets
   */
  'zAdd',
  'zCard',
  'zRange',
  'zRem',
  'zScore',

  /**
   * Scripting
   */
  'eval',
  'evalSha',
  'scriptLoad',

  /**
   * Server
   */
  'dbSize',
  'echo',
  'flushAll',
  'flushDb',
  'info',
  'ping',
  'time',
] satisfies (keyof RedisClientType)[]
