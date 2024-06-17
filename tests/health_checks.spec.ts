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
import { RedisHealthCheck } from '../src/redis_health_check.js'
import RedisConnection from '../src/connections/redis_connection.js'
import RedisClusterConnection from '../src/connections/redis_cluster_connection.js'
import stringHelpers from '@adonisjs/core/helpers/string'

const nodes = process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
  return { host: process.env.REDIS_HOST!, port: Number(port) }
})

test.group('Health check | redis connection', () => {
  test('get report for connection in ready state', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisHealthCheck(connection)
    const result = await healthCheck.run()
    assert.containsSubset(result, {
      message: 'Successfully connected to the redis server',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
      },
    })
  })

  test('wait until connection gets ready', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    const healthCheck = new RedisHealthCheck(connection)
    const result = await healthCheck.run()
    assert.containsSubset(result, {
      message: 'Successfully connected to the redis server',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
      },
    })
  })

  test('track memory usage', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisHealthCheck(connection).failWhenExceeds('500 mb')

    const result = await healthCheck.run()
    assert.exists(result.meta?.memoryInBytes.used)
    assert.containsSubset(result, {
      message: 'Successfully connected to the redis server',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
        },
      },
    })
  })

  test('report error when unable to connect to the server', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: 4444,
    })
    cleanup(() => connection.quit())

    const healthCheck = new RedisHealthCheck(connection)

    const result = await healthCheck.run()
    assert.equal(result.message, 'Unable to connect to the redis server')
    assert.equal(result.meta?.error.code, 'ECONNREFUSED')
  })

  test('report warning when warning threshold is crossed', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisHealthCheck(connection)
      .warnWhenExceeds('100 mb')
      .compute(async () => {
        return stringHelpers.bytes.parse('101 mb')
      })

    const result = await healthCheck.run()
    assert.containsSubset(result, {
      message: 'Redis memory usage is "101MB", which is above the threshold of "100MB".',
      status: 'warning',
      meta: {
        connection: {
          name: 'main',
        },
        memoryInBytes: {
          failureThreshold: undefined,
          used: 105906176,
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

    const healthCheck = new RedisHealthCheck(connection)
      .warnWhenExceeds('100 mb')
      .failWhenExceeds('200 mb')
      .compute(async () => {
        return stringHelpers.bytes.parse('201 mb')
      })

    const result = await healthCheck.run()
    assert.containsSubset(result, {
      message: 'Redis memory usage is "201MB", which is above the threshold of "200MB".',
      status: 'error',
      meta: {
        connection: {
          name: 'main',
        },
        memoryInBytes: {
          failureThreshold: 209715200,
          used: 210763776,
          warningThreshold: 104857600,
        },
      },
    })
  })
})

test.group('Health check | cluster connection', () => {
  test('get report for connection in ready state', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisHealthCheck(connection)
    const result = await healthCheck.run()
    assert.containsSubset(result, {
      message: 'Successfully connected to the redis server',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
      },
    })
  })

  test('wait until connection gets ready', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    const healthCheck = new RedisHealthCheck(connection)
    const result = await healthCheck.run()
    assert.containsSubset(result, {
      message: 'Successfully connected to the redis server',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
          status: 'ready',
        },
      },
    })
  })

  test('track memory usage', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisHealthCheck(connection).failWhenExceeds('500 mb')

    const result = await healthCheck.run()
    assert.exists(result.meta?.memoryInBytes.used)
    assert.containsSubset(result, {
      message: 'Successfully connected to the redis server',
      status: 'ok',
      meta: {
        connection: {
          name: 'main',
        },
      },
    })
  })

  test('report error when unable to connect to the server', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection(
      'main',
      [{ host: process.env.REDIS_HOST!, port: 5000 }],
      {}
    )

    cleanup(() => connection.quit())

    const healthCheck = new RedisHealthCheck(connection)

    const result = await healthCheck.run()
    assert.equal(result.message, 'Unable to connect to the redis server')
    assert.equal(result.meta?.error.message, 'Failed to refresh slots cache.')
  })
})
