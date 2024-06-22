/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { setTimeout } from 'node:timers/promises'
import { BaseCheck, Result } from '@adonisjs/core/health'
import type { HealthCheckResult } from '@adonisjs/core/types/health'
import type { Connection } from '../types.js'

/**
 * The RedisCheck pings the redis server to ensure we are
 * able to connect to it.
 */
export class RedisCheck extends BaseCheck {
  #connection: Connection

  /**
   * Number of times `ping` was deferred, at max we defer it for 3 times
   */
  #pingAttempts = 0

  /**
   * Health check public name
   */
  name: string

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
   * Internal method to ping the redis server
   */
  async #ping(): Promise<Result | undefined> {
    /**
     * When in connecting status, we should wait for maximum 3 seconds with
     * (divided into 3 attempts). However, if there was an error, we will
     * not wait for 3 seconds.
     */
    if (this.#connection.isConnecting() && this.#pingAttempts < 3 && !this.#connection.lastError) {
      await setTimeout(1000)
      this.#pingAttempts++
      return this.#ping()
    }

    /**
     * Re-connect when connection is in closed state
     */
    if (this.#connection.isClosed()) {
      await this.#connection.ioConnection.connect()
      return this.#ping()
    }

    /**
     * If we are not in `connect` or `ready` state, then we should
     * report an error.
     */
    if (!this.#connection.isConnecting()) {
      return Result.failed(
        'Unable to connect to the redis server',
        this.#connection.lastError
      ).mergeMetaData(this.#getConnectionMetadata())
    }

    await this.#connection.ping()
  }

  /**
   * Executes the health check
   */
  async run(): Promise<HealthCheckResult> {
    try {
      const result = await this.#ping()
      if (result) {
        return result
      }

      return Result.ok('Successfully connected to the redis server').mergeMetaData(
        this.#getConnectionMetadata()
      )
    } catch (error) {
      return Result.failed(error).mergeMetaData(this.#getConnectionMetadata())
    }
  }
}
