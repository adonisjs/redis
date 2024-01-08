/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'

/**
 * Promisify an event
 */
export function pEvent<T, K extends keyof T>(
  emitter: Emittery<T>,
  event: K,
  timeout: number = 500
) {
  return new Promise<T[K] | null>((resolve) => {
    function handler(data: T[K]) {
      emitter.off(event, handler)
      resolve(data)
    }

    setTimeout(() => {
      emitter.off(event, handler)
      resolve(null)
    }, timeout)
    emitter.on(event, handler)
  })
}
