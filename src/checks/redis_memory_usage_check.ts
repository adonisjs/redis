/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { setTimeout } from 'node:timers/promises'
import stringHelpers from '@adonisjs/core/helpers/string'
import { BaseCheck, Result } from '@adonisjs/core/health'
import type { HealthCheckResult } from '@adonisjs/core/types/health'

import type { Connection } from '../types.js'

/**
 * The RedisMemoryUsageCheck can be used to monitor the memory
 * consumption of a redis server and report a warning or error
 * after a certain threshold has been execeeded.
 */
export class RedisMemoryUsageCheck extends BaseCheck {
  #connection: Connection

  /**
   * Number of times `ping` was deferred, at max we defer it for 3 times
   */
  #pingAttempts = 0

  /**
   * Method to compute the memory consumption
   */
  #computeFn: (connection: Connection) => Promise<number | null> = async (connection) => {
    const memory = await connection.info('memory')

    const memorySegment = memory
      .split(/\r|\r\n/)
      .find((line) => line.trim().startsWith('used_memory'))

    if (!memorySegment) {
      return null
    }

    const memoryUsageInBytes = Number(memorySegment.split(':')[1])
    return Number.isNaN(memoryUsageInBytes) ? null : memoryUsageInBytes
  }

  /**
   * Memory consumption threshold after which a warning will be created
   */
  #warnThreshold: number = stringHelpers.bytes.parse('100 mb')

  /**
   * Memory consumption threshold after which an error will be created
   */
  #failThreshold: number = stringHelpers.bytes.parse('120 mb')

  /**
   * Health check public name
   */
  name: string

  constructor(connection: Connection) {
    super()
    this.#connection = connection
    this.name = `Redis memory consumption health check (${connection.connectionName})`
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
   * Returns memory usage metadata to be shared in the health checks
   * report
   */
  #getMemoryMetadata(used?: number) {
    return {
      memoryInBytes: {
        used: used,
        warningThreshold: this.#warnThreshold,
        failureThreshold: this.#failThreshold,
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
   * Define the memory threshold after which a warning
   * should be created.
   *
   * - The value should be either a number in bytes
   * - Or it should be a value expression in string.
   *
   * ```
   * .warnWhenExceeds('200 mb')
   * ```
   */
  warnWhenExceeds(value: string | number) {
    this.#warnThreshold = stringHelpers.bytes.parse(value)
    return this
  }

  /**
   * Define the memory threshold after which an error
   * should be created.
   *
   * - The value should be either a number in bytes
   * - Or it should be a value expression in string.
   *
   * ```
   * .warnWhenExceeds('200 mb')
   * ```
   */
  failWhenExceeds(value: string | number) {
    this.#failThreshold = stringHelpers.bytes.parse(value)
    return this
  }

  /**
   * Define a custom callback to compute Redis memory usage. The
   * return value must be a human readable string
   */
  compute(callback: (connection: Connection) => Promise<number | null>): this {
    this.#computeFn = callback
    return this
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

      /**
       * Get memory usage when tracking memory
       */
      const memoryUsage = await this.#computeFn(this.#connection)

      /**
       * Return early when we do not have access to the memory
       * usage.
       */
      if (!memoryUsage) {
        return Result.failed('Check failed. Unable to get redis memory info').mergeMetaData(
          this.#getConnectionMetadata()
        )
      }

      const memoryUsagePretty = stringHelpers.bytes.format(memoryUsage)
      const warnThresholdPretty = stringHelpers.bytes.format(this.#warnThreshold)
      const failureThresholdPretty = stringHelpers.bytes.format(this.#failThreshold)

      /**
       * Check if we have crossed the failure threshold
       */
      if (this.#failThreshold && memoryUsage > this.#failThreshold) {
        return Result.failed(
          `Redis memory usage is ${memoryUsagePretty}, which is above the threshold of ${failureThresholdPretty}`
        )
          .mergeMetaData(this.#getConnectionMetadata())
          .mergeMetaData(this.#getMemoryMetadata(memoryUsage))
      }

      /**
       * Check if we have crossed the warning threshold
       */
      if (this.#warnThreshold && memoryUsage > this.#warnThreshold) {
        return Result.warning(
          `Redis memory usage is ${stringHelpers.bytes.format(memoryUsage)}, which is above the threshold of ${warnThresholdPretty}`
        )
          .mergeMetaData(this.#getConnectionMetadata())
          .mergeMetaData(this.#getMemoryMetadata(memoryUsage))
      }

      return Result.ok(
        `Redis memory usage is ${memoryUsagePretty}, which is under the defined thresholds`
      )
        .mergeMetaData(this.#getConnectionMetadata())
        .mergeMetaData(this.#getMemoryMetadata(memoryUsage))
    } catch (error) {
      return Result.failed(error).mergeMetaData(this.#getConnectionMetadata())
    }
  }
}
