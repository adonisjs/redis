/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import stringHelpers from '@adonisjs/core/helpers/string'
import { BaseCheck, Result } from '@adonisjs/core/health'
import type { HealthCheckResult } from '@adonisjs/core/types/health'
import { probeConnection } from './probe_connection.ts'
import type { Connection } from '../types.ts'

/**
 * The RedisCheck pings the redis server to ensure we are
 * able to connect to it.
 *
 * The check fails at once when the connection is neither ready nor
 * connecting (for example while reconnecting), and fails when waiting
 * for the connection plus the ping take longer than the timeout. It
 * never connects or reconnects the connection itself.
 *
 * @example
 * ```ts
 * const check = new RedisCheck(redis.connection()).timeout('2s')
 * const result = await check.run()
 *
 * if (result.isHealthy) {
 *   console.log('Redis is healthy')
 * }
 * ```
 */
export class RedisCheck extends BaseCheck {
  /**
   * The Redis connection to check
   */
  #connection: Connection

  /**
   * Time in milliseconds to wait for the connection and the ping
   */
  #timeout = 1_000

  /**
   * Health check public name
   */
  name: string

  /**
   * Create a new RedisCheck instance
   *
   * @param connection - The Redis connection to monitor
   *
   * @example
   * ```ts
   * const check = new RedisCheck(redis.connection('main'))
   * ```
   */
  constructor(connection: Connection) {
    super()
    this.#connection = connection
    this.name = `Redis health check (${connection.connectionName})`
  }

  /**
   * Returns connection metadata to be shared in the health checks
   * report
   */
  #getConnectionMetadata() {
    return {
      connection: {
        name: this.#connection.connectionName,
        status: this.#connection.status,
      },
    }
  }

  /**
   * Define how long the check waits for a connecting connection and
   * the ping, together. Defaults to 1 second.
   *
   * @param duration - Milliseconds or a duration expression (e.g. '2s')
   *
   * @example
   * ```ts
   * check.timeout('2s')
   * check.timeout(500)
   * ```
   */
  timeout(duration: string | number) {
    this.#timeout = stringHelpers.milliseconds.parse(duration)
    return this
  }

  /**
   * Executes the health check
   *
   * @example
   * ```ts
   * const result = await check.run()
   * console.log(result.status) // 'ok' or 'error'
   * ```
   */
  async run(): Promise<HealthCheckResult> {
    const result = await probeConnection(this.#connection, this.#timeout, async () =>
      Result.ok('Successfully connected to the redis server')
    )

    return result.mergeMetaData(this.#getConnectionMetadata())
  }
}
