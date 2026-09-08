/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { pEvent } from '../tests_helpers/main.ts'
import { RedisManagerFactory } from '../factories/redis_manager.ts'
import type RedisConnection from '../src/connections/redis_connection.ts'
import NodeRedisConnection from '../src/connections/node_redis_connection.ts'

const socket = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
}

test.group('Node redis connection | lifecycle', () => {
  test('do not dial the server until the first command', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    assert.equal(connection.status, 'wait')
    assert.isUndefined(connection.nodeConnection)
    assert.isFalse(connection.isReady())

    await connection.set('greeting', 'hello world')

    assert.equal(connection.status, 'ready')
    assert.isTrue(connection.isReady())
    assert.isDefined(connection.nodeConnection)
  })

  test('emit connect and ready events when connecting', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    const [connect, ready] = await Promise.all([
      pEvent(connection, 'connect'),
      pEvent(connection, 'ready'),
      connection.connect(),
    ])

    assert.strictEqual(connect?.connection, connection)
    assert.strictEqual(ready?.connection, connection)
    assert.equal(connection.status, 'ready')
  })

  test('memoize the connect promise and share one client', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    const [client, ...clients] = await Promise.all([
      connection.connect(),
      connection.connect(),
      connection.connect(),
    ])

    clients.forEach((otherClient) => assert.strictEqual(otherClient, client))
    assert.strictEqual(connection.nodeConnection, client)
  })

  test('run concurrent commands issued before the connection is ready', async ({
    assert,
    cleanup,
  }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(async () => {
      await connection.del('counter')
      await connection.quit()
    })

    const results = await Promise.all([
      connection.incr('counter'),
      connection.incr('counter'),
      connection.incr('counter'),
    ])

    assert.deepEqual(results.sort(), [1, 2, 3])
  })

  test('emit error and reject when unable to connect', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', {
      client: 'node-redis',
      socket: { host: '127.0.0.1', port: 4444, reconnectStrategy: false },
    })
    cleanup(() => connection.disconnect())

    const [event, error] = await Promise.all([
      pEvent(connection, 'error'),
      connection.connect().catch((e) => e),
    ])

    assert.equal(error.message, 'connect ECONNREFUSED 127.0.0.1:4444')
    assert.equal(event?.error.message, 'connect ECONNREFUSED 127.0.0.1:4444')
    assert.equal(connection.lastError.message, 'connect ECONNREFUSED 127.0.0.1:4444')
    assert.isTrue(connection.isClosed())
  })

  test('emit end and cleanup listeners on quit', async ({ assert }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    await connection.connect()

    const [event] = await Promise.all([pEvent(connection, 'end'), connection.quit()])

    assert.isNotNull(event)
    assert.equal(connection.status, 'end')
    assert.isTrue(connection.isClosed())
    assert.isUndefined(connection.nodeConnection)
  })

  test('do not dial the server when quitting a lazy connection', async ({ assert }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })

    const [event] = await Promise.all([pEvent(connection, 'end'), connection.quit()])

    assert.isNotNull(event)
    assert.equal(connection.status, 'end')
    assert.isUndefined(connection.nodeConnection)
  })

  test('emit end on disconnect', async ({ assert }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    await connection.connect()

    const [event] = await Promise.all([pEvent(connection, 'end'), connection.disconnect()])

    assert.isNotNull(event)
    assert.equal(connection.status, 'end')
  })

  test('throw when using the connection after it has been closed', async ({ assert }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    await connection.connect()
    await connection.quit()

    await assert.rejects(
      () => connection.get('greeting'),
      'Cannot use the "main" connection after it has been closed'
    )
  })
})

test.group('Node redis connection | commands', (group) => {
  group.each.setup(() => {
    const connection = new NodeRedisConnection('cleanup', { client: 'node-redis', socket })
    return async () => {
      await connection.del(['greeting', 'user', 'items', 'counter', 'ttl-key'])
      await connection.quit()
    }
  })

  test('run string commands', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    assert.equal(await connection.set('greeting', 'hello world'), 'OK')
    assert.equal(await connection.get('greeting'), 'hello world')
    assert.equal(await connection.exists('greeting'), 1)
    assert.equal(await connection.del('greeting'), 1)
    assert.isNull(await connection.get('greeting'))
  })

  test('use an options object for command modifiers', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    /**
     * ioredis: connection.set('ttl-key', 'value', 'EX', 60)
     */
    await connection.set('ttl-key', 'value', { EX: 60 })

    const ttl = await connection.ttl('ttl-key')
    assert.isAbove(ttl, 0)
    assert.isAtMost(ttl, 60)
  })

  test('run hash commands', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    await connection.hSet('user', { username: 'virk', age: '32' })

    assert.equal(await connection.hGet('user', 'username'), 'virk')
    assert.deepEqual(await connection.hGetAll('user'), { username: 'virk', age: '32' })
    const keys = await connection.hKeys('user')
    assert.deepEqual(keys.sort(), ['age', 'username'])
  })

  test('run list commands', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    await connection.rPush('items', ['one', 'two'])

    assert.equal(await connection.lLen('items'), 2)
    assert.deepEqual(await connection.lRange('items', 0, -1), ['one', 'two'])
  })

  test('publish a message', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    assert.equal(await connection.publish('news', 'hello'), 0)
  })

  test('publish a message using a callback', async ({ assert, cleanup }, done) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    connection.publish('news', 'hello', (error, count) => {
      assert.isNull(error)
      assert.equal(count, 0)
      done()
    })
  }).waitForDone()

  test('define and run a lua script', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    connection.defineCommand('setAndGet', {
      numberOfKeys: 1,
      lua: `redis.call('set', KEYS[1], ARGV[1]) return redis.call('get', KEYS[1])`,
    })

    assert.equal(await connection.runCommand('setAndGet', 'greeting', 'hello world'), 'hello world')
    assert.equal(await connection.get('greeting'), 'hello world')
  })

  test('throw when running an undefined command', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    await assert.rejects(() => connection.runCommand('foo'), 'Cannot run undefined command "foo"')
  })

  test('throw when subscribing', async ({ assert, cleanup }) => {
    const connection = new NodeRedisConnection('main', { client: 'node-redis', socket })
    cleanup(() => connection.quit())

    assert.throws(
      () => connection.subscribe(),
      'Pub/Sub is not implemented for node-redis connections. Use "await connection.connect()" and subscribe using a duplicated client'
    )
  })
})

test.group('Node redis connection | manager', () => {
  test('create a node-redis connection from the manager config', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        modern: { client: 'node-redis' as const, socket },
      },
    }).create()

    const connection = redis.connection('modern')
    assert.instanceOf(connection, NodeRedisConnection)

    await connection.set('greeting', 'hello world')
    assert.equal(await connection.get('greeting'), 'hello world')
    await connection.del('greeting')

    assert.equal(redis.activeConnectionsCount, 1)
    await redis.quitAll()
  })

  test('infer the connection type from the config', async ({ expectTypeOf }) => {
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        modern: { client: 'node-redis' as const, socket },
      },
    }).create()

    expectTypeOf(redis.connection('primary')).toEqualTypeOf<RedisConnection>()
    expectTypeOf(redis.connection('modern')).toEqualTypeOf<NodeRedisConnection>()
  })

  test('re-use the same connection instance', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'modern',
      connections: {
        modern: { client: 'node-redis' as const, socket },
      },
    }).create()

    assert.strictEqual(redis.connection('modern'), redis.connection())
    await redis.quitAll()
  })

  test('forget the connection once it has been closed', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'modern',
      connections: {
        modern: { client: 'node-redis' as const, socket },
      },
    }).create()

    const connection = redis.connection()
    await connection.connect()

    await Promise.all([pEvent(connection, 'end'), redis.quitAll()])
    assert.equal(redis.activeConnectionsCount, 0)
  })

  test('share manager level lua scripts with node-redis connections', async ({ assert }) => {
    const redis = new RedisManagerFactory({
      connection: 'modern',
      connections: {
        modern: { client: 'node-redis' as const, socket },
      },
    }).create()

    redis.defineCommand('setAndGet', {
      numberOfKeys: 1,
      lua: `redis.call('set', KEYS[1], ARGV[1]) return redis.call('get', KEYS[1])`,
    })

    assert.equal(await redis.runCommand('setAndGet', 'greeting', 'hi'), 'hi')

    await redis.connection().del('greeting')
    await redis.quitAll()
  })
})
