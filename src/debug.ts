/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { debuglog } from 'node:util'

/**
 * Debug logger for AdonisJS Redis package.
 * Enable with NODE_DEBUG=adonisjs:redis
 *
 * @example
 * ```ts
 * import debug from './debug.ts'
 *
 * debug('Creating connection %s', connectionName)
 * ```
 */
export default debuglog('adonisjs:redis')
