/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { createError } from '@poppinss/utils'

/** @deprecated */
export const E_MULTIPLE_REDIS_SUBSCRIPTIONS = createError<[string]>(
  'Cannot subscribe to "%s" channel. Channel already has an active subscription',
  'E_MULTIPLE_REDIS_SUBSCRIPTIONS',
  500
)

/** @deprecated */
export const E_MULTIPLE_REDIS_PSUBSCRIPTIONS = createError<[string]>(
  'Cannot subscribe to "%s" pattern. Pattern already has an active subscription',
  'E_MULTIPLE_REDIS_PSUBSCRIPTIONS',
  500
)
