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

import type { Connection } from './types.js'

/**
 * The RedisHealthCheck pings the redis server to ensure we are
 * able to connect to it. Optionally you can check the memory
 * consumption and define "warning" + "failure" thresholds
 */
export class RedisHealthCheck extends BaseCheck {
  #connection: Connection

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
   * Should we be tracking memory. The flag is set to true
   * automatically after the "warning" or the "error"
   * thresholds are defined
   */
  #trackMemory: boolean = false

  /**
   * Memory consumption threshold after which a warning will be created
   */
  #warnThreshold?: number

  /**
   * Memory consumption threshold after which an error will be created
   */
  #failThreshold?: number

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
    this.name = `Redis health check for ${connection.connectionName} connection`
  }

  /**
   * Returns a boolean notifying if the connection is
   * in connecting state
   */
  #isConnecting() {
    return this.#connection.status === 'connecting' || this.#connection.status === 'reconnecting'
  }

  /**
   * Returns a boolean notifying id the connection is in
   * ready state
   */
  #isReady() {
    return this.#connection.status === 'ready' || this.#connection.status === 'connect'
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
    if (this.#isConnecting() && this.#pingAttempts < 3 && !this.#connection.lastError) {
      await setTimeout(1000)
      this.#pingAttempts++
      return this.#ping()
    }

    /**
     * If we are not in `connect` or `ready` state, then we should
     * report an error.
     */
    if (!this.#isReady()) {
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
    this.#trackMemory = true
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
    this.#trackMemory = true
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
      const memoryUsage = this.#trackMemory ? await this.#computeFn(this.#connection) : null

      /**
       * Return early when we do not have access to the memory
       * usage.
       */
      if (!memoryUsage) {
        return Result.ok('Successfully connected to the redis server').mergeMetaData(
          this.#getConnectionMetadata()
        )
      }

      /**
       * Check if we have crossed the failure threshold
       */
      if (this.#failThreshold && memoryUsage > this.#failThreshold) {
        return Result.failed(
          `Memory usage exceeded the "${stringHelpers.bytes.format(this.#failThreshold)}" threshold`
        )
          .mergeMetaData(this.#getConnectionMetadata())
          .mergeMetaData(this.#getMemoryMetadata(memoryUsage))
      }

      /**
       * Check if we have crossed the warning threshold
       */
      if (this.#warnThreshold && memoryUsage > this.#warnThreshold) {
        return Result.warning(
          `Memory usage exceeded the "${stringHelpers.bytes.format(this.#warnThreshold)}" threshold`
        )
          .mergeMetaData(this.#getConnectionMetadata())
          .mergeMetaData(this.#getMemoryMetadata(memoryUsage))
      }

      return Result.ok('Successfully connected to the redis server')
        .mergeMetaData(this.#getConnectionMetadata())
        .mergeMetaData(this.#getMemoryMetadata(memoryUsage))
    } catch (error) {
      return Result.failed(error).mergeMetaData(this.#getConnectionMetadata())
    }
  }
}
