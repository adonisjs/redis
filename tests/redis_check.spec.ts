/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { once } from 'node:events'
import { test } from '@japa/runner'

import { createSilentServer, pEvent } from '../tests_helpers/main.ts'
import { RedisCheck } from '../src/checks/redis_check.ts'
import RedisConnection from '../src/connections/redis_connection.ts'
import RedisClusterConnection from '../src/connections/redis_cluster_connection.ts'

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
    assert.containSubset(result, {
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
    assert.containSubset(result, {
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
  test('fail within the timeout when the server stops answering', async ({ assert, cleanup }) => {
    const server = await createSilentServer()
    cleanup(() => server.close())

    const connection = new RedisConnection('main', {
      host: '127.0.0.1',
      port: server.port,
      enableReadyCheck: false,
    })
    cleanup(() => connection.disconnect())
    await pEvent(connection, 'ready')
    server.silence()

    const healthCheck = new RedisCheck(connection).timeout(200)
    for (let run = 0; run < 2; run++) {
      const startedAt = Date.now()
      const result = await healthCheck.run()

      assert.isBelow(Date.now() - startedAt, 400)
      assert.containSubset(result, {
        message: 'Redis did not respond within 200ms',
        status: 'error',
        meta: { connection: { name: 'main', status: 'ready' } },
      })
    }
  })

  test('fail at once with the last error while reconnecting', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: '127.0.0.1',
      port: 1,
      retryStrategy: () => 5_000,
    })
    cleanup(() => connection.disconnect())
    await pEvent(connection, 'reconnecting')

    const healthCheck = new RedisCheck(connection).timeout('2s')
    for (let run = 0; run < 2; run++) {
      const startedAt = Date.now()
      const result = await healthCheck.run()

      assert.isBelow(Date.now() - startedAt, 50)
      assert.containSubset(result, {
        message: 'Unable to connect to the redis server',
        status: 'error',
        meta: { connection: { status: 'reconnecting' }, error: { code: 'ECONNREFUSED' } },
      })
    }
  })

  test('wait for a connecting connection on every run of the same check', async ({
    assert,
    cleanup,
  }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())
    await pEvent(connection, 'ready')

    const healthCheck = new RedisCheck(connection)
    for (let run = 0; run < 4; run++) {
      connection.ioConnection.disconnect()
      await once(connection.ioConnection, 'end')
      connection.ioConnection.connect()
      assert.equal(connection.status, 'connecting')

      const result = await healthCheck.run()
      assert.containSubset(result, {
        message: 'Successfully connected to the redis server',
        status: 'ok',
        meta: { connection: { status: 'ready' } },
      })
    }
  })

  test('do not reconnect a closed connection', async ({ assert }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    await pEvent(connection, 'ready')
    await connection.quit()
    await pEvent(connection, 'end')

    const result = await new RedisCheck(connection).run()
    assert.containSubset(result, {
      message: 'Unable to connect to the redis server',
      status: 'error',
      meta: { connection: { status: 'end' } },
    })
    assert.equal(connection.status, 'end')
  })
})

test.group('Health check | cluster connection', () => {
  test('get report for cluster connection in ready state', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const healthCheck = new RedisCheck(connection)
    const result = await healthCheck.run()
    assert.containSubset(result, {
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

  test('wait until cluster connection gets ready', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    const healthCheck = new RedisCheck(connection)
    const result = await healthCheck.run()
    assert.containSubset(result, {
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

  test('report error when unable to connect to the cluster', async ({ assert, cleanup }) => {
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
