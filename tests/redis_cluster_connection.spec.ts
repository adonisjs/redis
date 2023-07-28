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
import RedisClusterConnection from '../src/connections/redis_cluster_connection.js'

const nodes = process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
  return { host: process.env.REDIS_HOST!, port: Number(port) }
})

test.group('Redis cluster factory', () => {
  test('emit ready when connected to redis server', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')
    assert.equal(connection.status, 'ready')
  })

  test('emit connect event before the ready event', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'connect')
    await pEvent(connection, 'ready')
    assert.equal(connection.status, 'ready')
  })

  test('emit node:added event', async ({ cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'node:added')
  })

  test('execute redis commands', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(async () => {
      await connection.del('greeting')
      await connection.quit()
    })

    await connection.set('greeting', 'hello world')
    const greeting = await connection.get('greeting')
    assert.equal(greeting, 'hello world')
  })

  test('clean event listeners on quit', async ({ assert }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    await pEvent(connection, 'ready')

    await Promise.all([pEvent(connection, 'end'), connection.quit()])
    assert.equal(connection.ioConnection.listenerCount('connect'), 0)
    assert.equal(connection.ioConnection.listenerCount('ready'), 0)
    assert.equal(connection.ioConnection.listenerCount('error'), 0)
    assert.equal(connection.ioConnection.listenerCount('close'), 0)
    assert.equal(connection.ioConnection.listenerCount('reconnecting'), 0)
    assert.equal(connection.ioConnection.listenerCount('end'), 0)
    assert.equal(connection.ioConnection.listenerCount('wait'), 0)
  })

  test('clean event listeners on disconnect', async ({ assert }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    await pEvent(connection, 'ready')

    await Promise.all([pEvent(connection, 'end'), connection.disconnect()])
    assert.equal(connection.ioConnection.listenerCount('connect'), 0)
    assert.equal(connection.ioConnection.listenerCount('ready'), 0)
    assert.equal(connection.ioConnection.listenerCount('error'), 0)
    assert.equal(connection.ioConnection.listenerCount('close'), 0)
    assert.equal(connection.ioConnection.listenerCount('reconnecting'), 0)
    assert.equal(connection.ioConnection.listenerCount('end'), 0)
    assert.equal(connection.ioConnection.listenerCount('wait'), 0)
  })

  test('emit node:error when unable to connect', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection(
      'main',
      [{ host: process.env.REDIS_HOST!, port: 5000 }],
      {}
    )
    cleanup(() => connection.quit())

    connection.on('error', () => {})
    const [error] = await pEvent(connection, 'node:error', { multiArgs: true })
    assert.equal(error.message, 'Connection is closed.')
  })

  test('access cluster nodes', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')
    assert.isAbove(connection.nodes().length, 2) // defined in compose file
  })

  test('get report for connection in ready state', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const report = await connection.getReport(true)
    assert.equal(report.status, 'ready')
    assert.isNull(report.error)
    assert.isDefined(report.used_memory)
  })

  test('get report for errored connection', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection(
      'main',
      [{ host: process.env.REDIS_HOST!, port: 5000 }],
      {}
    )

    cleanup(() => connection.quit())

    await pEvent(connection, 'error')

    const report = await connection.getReport(true)
    assert.notEqual(report.status, 'ready')
    assert.equal(report.error.message, 'Failed to refresh slots cache.')
    assert.equal(report.used_memory, null)
  })

  test('execute redis commands using lua scripts', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(async () => {
      await connection.del('greeting')
      await connection.quit()
    })

    connection.defineCommand('defineValue', {
      numberOfKeys: 1,
      lua: `redis.call('set', KEYS[1], ARGV[1])`,
    })

    connection.defineCommand('readValue', {
      numberOfKeys: 1,
      lua: `return redis.call('get', KEYS[1])`,
    })

    await connection.runCommand('defineValue', 'greeting', 'hello world')
    const greeting = await connection.runCommand('readValue', 'greeting')
    assert.equal(greeting, 'hello world')
  })

  test('subscribe to a channel and listen for messages', async ({ assert, cleanup }) => {
    const connection = new RedisClusterConnection('main', nodes, {})
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const [message] = await Promise.all([
      new Promise((resolve) => {
        connection.subscribe('new:user', resolve)
      }),
      pEvent(connection, 'subscription:ready').then(() => {
        connection.publish('new:user', JSON.stringify({ username: 'virk' }))
      }),
    ])

    assert.equal(message, JSON.stringify({ username: 'virk' }))
  })
})
