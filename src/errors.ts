/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { createError } from '@poppinss/utils/exception'

/**
 * Error thrown when an invalid bytes value is provided
 *
 * @example
 * ```ts
 * // This will throw E_INVALID_BYTES_VALUE
 * check.warnWhenExceeds('invalid-value')
 * ```
 */
export const E_INVALID_BYTES_VALUE = createError<[string | number]>(
  'Invalid bytes value "%s"',
  'E_INVALID_BYTES_VALUE',
  500
)
