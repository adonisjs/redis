/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { pEvent } from '../tests_helpers/main.js'
import RedisConnection from '../src/connections/redis_connection.js'
import { RedisMemoryUsageCheck } from '../src/checks/redis_memory_usage_check.js'
import RedisClusterConnection from '../src/connections/redis_cluster_connection.js'
import stringHelpers from '@adonisjs/core/helpers/string'

const nodes = process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
  return { host: process.env.REDIS_HOST!, port: Number(port) }
})

test.group('Redis memory usage | redis connection', () => {
  test('track memory usage', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    cleanup(() => connection.quit())
    await pEvent(connection, 'ready')

    const healthCheck = new RedisMemoryUsageCheck(connection).failWhenExceeds('500 mb')
    const result = await healthCheck.run()

    assert.containsSubset(result, {
      message: 'Redis memory usage is under defined thresholds',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
        memoryInBytes: {
          warningThreshold: 104857600,
          failureThreshold: 524288000,
        },
      },
    })
  })

  test('return error when connection is not in connected state', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    cleanup(() => connection.quit())

    const healthCheck = new RedisMemoryUsageCheck(connection).failWhenExceeds('500 mb')
    const result = await healthCheck.run()

    assert.containsSubset(result, {
      message: 'Check failed. The redis connection is not ready yet',
      status: 'error',
      meta: {
        connection: {
          name: 'main',
        },
      },
    })
  })

  test('report warning when warning threshold is crossed', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    cleanup(() => connection.quit())
    await pEvent(connection, 'ready')

    const healthCheck = new RedisMemoryUsageCheck(connection)
      .warnWhenExceeds('100 mb')
      .compute(async () => {
        return stringHelpers.bytes.parse('101 mb')
      })
    const result = await healthCheck.run()

    assert.containsSubset(result, {
      message: 'Redis memory usage is 101MB, which is above the threshold of 100MB',
      status: 'warning',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
        memoryInBytes: {
          used: 105906176,
          failureThreshold: 125829120,
          warningThreshold: 104857600,
        },
      },
    })
  })

  test('report error when failure threshold is crossed', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisMemoryUsageCheck(connection)
      .warnWhenExceeds('100 mb')
      .failWhenExceeds('200 mb')
      .compute(async () => {
        return stringHelpers.bytes.parse('201 mb')
      })

    const result = await healthCheck.run()
    assert.containsSubset(result, {
      message: 'Redis memory usage is 201MB, which is above the threshold of 200MB',
      status: 'error',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
        memoryInBytes: {
          used: 210763776,
          failureThreshold: 209715200,
          warningThreshold: 104857600,
        },
      },
    })
  })

  test('return error when unable to compute memory', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    cleanup(() => connection.quit())
    await pEvent(connection, 'ready')

    const healthCheck = new RedisMemoryUsageCheck(connection).compute(async () => {
      return null
    })
    const result = await healthCheck.run()

    assert.containsSubset(result, {
      message: 'Check failed. Unable to get redis memory info',
      status: 'error',
      meta: {
        connection: {
          name: 'main',
        },
      },
    })
  })
})

test.group('Redis memory usage | cluster connection', () => {
  test('track memory usage', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisMemoryUsageCheck(connection).failWhenExceeds('500 mb')
    const result = await healthCheck.run()

    assert.containsSubset(result, {
      message: 'Redis memory usage is under defined thresholds',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
        memoryInBytes: {
          warningThreshold: 104857600,
          failureThreshold: 524288000,
        },
      },
    })
  })
})
