/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { pEvent } from 'p-event'
import { test } from '@japa/runner'

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
})
