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
import { RedisCheck } from '../src/checks/redis_check.js'
import RedisConnection from '../src/connections/redis_connection.js'
import RedisClusterConnection from '../src/connections/redis_cluster_connection.js'

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

    const healthCheck = new RedisCheck(connection)
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

    const healthCheck = new RedisCheck(connection)
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
})

test.group('Health check | cluster connection', () => {
  test('get report for connection in ready state', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisCheck(connection)
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

    const healthCheck = new RedisCheck(connection)
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

  test('report error when unable to connect to the server', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection(
      'main',
      [{ host: process.env.REDIS_HOST!, port: 5000 }],
      {}
    )

    cleanup(() => connection.quit())

    const healthCheck = new RedisCheck(connection)

    const result = await healthCheck.run()
    assert.equal(result.message, 'Unable to connect to the redis server')
    assert.equal(result.meta?.error.message, 'Failed to refresh slots cache.')
  })
})
