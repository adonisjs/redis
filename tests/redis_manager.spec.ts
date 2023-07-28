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
import { RedisManagerFactory } from '../factories/redis_manager.js'
import RedisConnection from '../src/connections/redis_connection.js'
import RedisClusterConnection from '../src/connections/redis_cluster_connection.js'

const clusterNodes = process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
  return { host: process.env.REDIS_HOST!, port: Number(port) }
})

export const BASE_URL = new URL('./tmp/', import.meta.url)

test.group('Redis Manager', () => {
  test('.connection() types should be inferred from config', async ({ expectTypeOf }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        secondary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    expectTypeOf(redis.connection).parameter(0).toEqualTypeOf<'primary' | 'secondary' | undefined>()
  })

  test('throw error when trying to use unregistered redis connection', async () => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    // @ts-expect-error
    redis.connection('foo')
  }).throws('Redis connection "foo" is not defined')

  test('run redis commands from the manager', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await redis.set('greeting', 'hello-world')
    const greeting = await redis.get('greeting')

    assert.equal(greeting, 'hello-world')

    await redis.del('greeting')
    await redis.quit('primary')
  })

  test('run redis commands using default connection', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await redis.connection().set('greeting', 'hello-world')
    const greeting = await redis.connection().get('greeting')

    assert.equal(greeting, 'hello-world')

    await redis.connection().del('greeting')
    await redis.quit('primary')
  })

  test('run redis commands using an explicit connection', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await redis.connection('primary').set('greeting', 'hello-world')
    const greeting = await redis.connection('primary').get('greeting')
    assert.equal(greeting, 'hello-world')

    await redis.connection('primary').del('greeting')
    await redis.quit('primary')
  })

  test('cache connections', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    assert.strictEqual(redis.connection(), redis.connection())
    await redis.quit()
  })

  test('connect to redis cluster when cluster array is defined', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        cluster: { clusters: clusterNodes },
      },
    }).create()

    await pEvent(redis.connection('cluster'), 'ready')
    assert.isAbove(redis.connection('cluster').nodes().length, 2)
    await redis.quit()
  })

  test('on quit clear connection from tracked list', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await pEvent(redis.connection(), 'ready')

    await Promise.all([pEvent(redis.connection(), 'end'), redis.quit()])
    assert.equal(redis.activeConnectionsCount, 0)
  })

  test('quit all connections', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        secondary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await pEvent(redis.connection(), 'ready')

    await Promise.all([
      pEvent(redis.connection(), 'end'),
      pEvent(redis.connection('secondary'), 'end'),
      redis.quitAll(),
    ])
    assert.equal(redis.activeConnectionsCount, 0)
  })

  test('on disconnect clear connection from tracked list', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await pEvent(redis.connection(), 'ready')

    await Promise.all([pEvent(redis.connection(), 'end'), redis.disconnect()])
    assert.equal(redis.activeConnectionsCount, 0)
  })

  test('disconnect all connections', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        secondary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await pEvent(redis.connection(), 'ready')

    await Promise.all([
      pEvent(redis.connection(), 'end'),
      pEvent(redis.connection('secondary'), 'end'),
      redis.disconnectAll(),
    ])
    assert.equal(redis.activeConnectionsCount, 0)
  })

  test('noop when trying to quit a non-existing connection', async () => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        secondary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    redis.quit()
  })

  test('noop when trying to disconnect a non-existing connection', async () => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        secondary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    redis.disconnect()
  })

  test('clear connection from tracked list when quit from the connection instance directly', async ({
    assert,
  }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    await pEvent(redis.connection(), 'ready')

    await Promise.all([pEvent(redis.connection(), 'end'), redis.connection().quit()])
    assert.equal(redis.activeConnectionsCount, 0)
  })

  test('should have connection types inferred from config', async ({ expectTypeOf }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
        },
        cluster: {
          clusters: clusterNodes,
        },
      },
    }).create()

    expectTypeOf(redis.connection('cluster')).toEqualTypeOf<RedisClusterConnection>()
    expectTypeOf(redis.connection('primary')).toEqualTypeOf<RedisConnection>()
  })

  test('notify listener about a new connection', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()

    const [connection] = await Promise.all([pEvent(redis, 'connection'), redis.connection()])
    assert.strictEqual(connection, redis.connection())
  })

  test('log errors using the logger', async ({ assert }) => {
    const manager = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: 4444,
          retryStrategy() {
            return null
          },
        },
      },
    })

    const redis = manager.create()
    await pEvent(redis.connection(), 'end')

    const errorLog = JSON.parse(manager.logs[0])
    assert.equal(errorLog.level, 60)
    assert.equal(errorLog.err.message, 'connect ECONNREFUSED 127.0.0.1:4444')
  })

  test('disable error logging', async ({ assert }) => {
    const manager = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: 4444,
          retryStrategy() {
            return null
          },
        },
      },
    })

    const redis = manager.create()
    redis.doNotLogErrors()

    redis.on('connection', (connection) => {
      connection.on('error', () => {})
    })

    await pEvent(redis.connection(), 'end')
    assert.lengthOf(manager.logs, 0)
  })

  test('disable error logging for an existing connection', async ({ assert }) => {
    const manager = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: 4444,
          retryStrategy() {
            return null
          },
        },
      },
    })

    const redis = manager.create()
    redis.on('connection', (connection) => {
      connection.on('error', () => {})
    })

    await Promise.all([pEvent(redis.connection(), 'end'), redis.doNotLogErrors()])
    assert.lengthOf(manager.logs, 0)
  })

  test('subscribe to a channel using manager', async ({ assert, cleanup }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()
    cleanup(() => redis.quitAll())

    const connection = redis.connection()
    await pEvent(connection, 'ready')

    const [message] = await Promise.all([
      new Promise((resolve) => {
        redis.subscribe('new:user', resolve)
      }),
      pEvent(connection, 'subscription:ready').then(() => {
        redis.publish('new:user', JSON.stringify({ username: 'virk' }))
      }),
    ])

    assert.equal(message, JSON.stringify({ username: 'virk' }))
  })

  test('subscribe to a pattern using manager', async ({ assert, cleanup }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()
    cleanup(() => redis.quitAll())

    const connection = redis.connection()
    await pEvent(connection, 'ready')

    const [message] = await Promise.all([
      new Promise((resolve) => {
        redis.psubscribe('user:*', (_, data) => resolve(data))
      }),
      pEvent(connection, 'psubscription:ready').then(() => {
        redis.publish('user:add', JSON.stringify({ username: 'virk' }))
      }),
    ])

    assert.equal(message, JSON.stringify({ username: 'virk' }))
  })

  test('unsubscribe using manager', async ({ cleanup }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()
    cleanup(() => redis.quitAll())

    const connection = redis.connection()
    await pEvent(connection, 'ready')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        redis.subscribe('new:user', () => reject('Not expected to be called'))
        setTimeout(() => {
          resolve()
        }, 1500)
      }),
      pEvent(connection, 'subscription:ready').then(() => {
        return redis.unsubscribe('new:user').then(() => {
          redis.publish('new:user', JSON.stringify({ username: 'virk' }))
        })
      }),
    ])
  }).timeout(4000)

  test('punsubscribe using manager', async ({ cleanup }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()
    cleanup(() => redis.quitAll())

    const connection = redis.connection()
    await pEvent(connection, 'ready')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        redis.psubscribe('user:*', () => reject('Not expected to be called'))
        setTimeout(() => {
          resolve()
        }, 1500)
      }),
      pEvent(connection, 'psubscription:ready').then(() => {
        return redis.punsubscribe('user:*').then(() => {
          redis.publish('new:user', JSON.stringify({ username: 'virk' }))
        })
      }),
    ])
  }).timeout(4000)

  test('apply defined commands to connections', async ({ cleanup, assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()
    cleanup(() => redis.quitAll())

    redis.defineCommand('defineValue', {
      numberOfKeys: 1,
      lua: `redis.call('set', KEYS[1], ARGV[1])`,
    })

    redis.defineCommand('readValue', {
      numberOfKeys: 1,
      lua: `return redis.call('get', KEYS[1])`,
    })

    await redis.runCommand('defineValue', 'greeting', 'hello world')
    const greeting = await redis.runCommand('readValue', 'greeting')
    assert.equal(greeting, 'hello world')
  })

  test('apply defined commands on existing connections', async ({ cleanup, assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create()
    cleanup(() => redis.quitAll())

    const connection = redis.connection()

    redis.defineCommand('defineValue', {
      numberOfKeys: 1,
      lua: `redis.call('set', KEYS[1], ARGV[1])`,
    })

    redis.defineCommand('readValue', {
      numberOfKeys: 1,
      lua: `return redis.call('get', KEYS[1])`,
    })

    await connection.runCommand('defineValue', 'greeting', 'hello world')
    const greeting = await connection.runCommand('readValue', 'greeting')
    assert.equal(greeting, 'hello world')
  })
})
