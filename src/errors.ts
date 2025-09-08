/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { createError } from '@poppinss/utils/exception'

export const E_INVALID_BYTES_VALUE = createError<[string | number]>(
  'Invalid bytes value "%s"',
  'E_INVALID_BYTES_VALUE',
  500
)
