/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'
import { RedisService } from '../src/types/main.js'

let redis: RedisService

/**
 * Returns a singleton instance of the Redis manager from the
 * container
 */
await app.booted(async () => {
  redis = await app.container.make('redis')
})

export { redis as default }
