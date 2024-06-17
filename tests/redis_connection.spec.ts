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

test.group('Redis connection', () => {
  test('emit ready when connected to redis server', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    cleanup(() => connection.quit())
    await pEvent(connection, 'ready')
    assert.equal(connection.status, 'ready')
  })

  test('emit connect event before the ready event', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'connect')
    await pEvent(connection, 'ready')
    assert.equal(connection.status, 'ready')
  })

  test('emit error when unable to connect', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', { port: 4444 })
    cleanup(() => connection.disconnect())

    const response = await pEvent(connection, 'error')
    assert.equal(response!.error.message, 'connect ECONNREFUSED 127.0.0.1:4444')
  })

  test('cleanup listeners on quit', async ({ assert }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    await Promise.all([pEvent(connection, 'end'), connection.quit()])
    assert.equal(connection.ioConnection.listenerCount('connect'), 0)
    assert.equal(connection.ioConnection.listenerCount('ready'), 0)
    assert.equal(connection.ioConnection.listenerCount('error'), 0)
    assert.equal(connection.ioConnection.listenerCount('close'), 0)
    assert.equal(connection.ioConnection.listenerCount('reconnecting'), 0)
    assert.equal(connection.ioConnection.listenerCount('end'), 0)
    assert.equal(connection.ioConnection.listenerCount('wait'), 0)
  })

  test('cleanup listeners on disconnect', async ({ assert }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    await Promise.all([pEvent(connection, 'end'), connection.disconnect()])
    assert.equal(connection.ioConnection.listenerCount('connect'), 0)
    assert.equal(connection.ioConnection.listenerCount('ready'), 0)
    assert.equal(connection.ioConnection.listenerCount('error'), 0)
    assert.equal(connection.ioConnection.listenerCount('close'), 0)
    assert.equal(connection.ioConnection.listenerCount('reconnecting'), 0)
    assert.equal(connection.ioConnection.listenerCount('end'), 0)
    assert.equal(connection.ioConnection.listenerCount('wait'), 0)
  })

  test('execute redis commands', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    cleanup(async () => {
      await connection.del('greeting')
      await connection.quit()
    })

    await connection.set('greeting', 'hello world')
    const greeting = await connection.get('greeting')
    assert.equal(greeting, 'hello world')
  })

  test('execute redis commands using lua scripts', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
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
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
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

  test('throw error when subscribing to a channel twice', async ({ cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    connection.subscribe('new:user', () => {})
    await pEvent(connection, 'subscription:ready')
    connection.subscribe('new:user', () => {})
  }).throws('Cannot subscribe to "new:user" channel. Channel already has an active subscription')

  test('subscribe to a pattern and listen for messages', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    const [message] = await Promise.all([
      new Promise<any>((resolve) => {
        connection.psubscribe('user:*', (channel, data) => resolve({ channel, data }))
      }),
      pEvent(connection, 'psubscription:ready').then(() => {
        connection.publish('user:add', JSON.stringify({ username: 'virk' }))
      }),
    ])

    assert.equal(message.channel, 'user:add')
    assert.equal(message.data, JSON.stringify({ username: 'virk' }))
  })

  test('throw error when subscribing to a pattern twice', async ({ cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())

    await pEvent(connection, 'ready')

    connection.psubscribe('user:*', () => {})
    await pEvent(connection, 'psubscription:ready')

    connection.psubscribe('user:*', () => {})
  }).throws('Cannot subscribe to "user:*" pattern. Pattern already has an active subscription')

  test('unsubscribe from a channel', async ({ cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())
    await pEvent(connection, 'ready')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        connection.subscribe('new:user', () => reject('Not expected to be called'))
        setTimeout(() => {
          resolve()
        }, 1500)
      }),
      pEvent(connection, 'subscription:ready').then(() => {
        return connection.unsubscribe('new:user').then(() => {
          connection.publish('new:user', JSON.stringify({ username: 'virk' }))
        })
      }),
    ])
  }).timeout(4000)

  test('unsubscribe from a pattern', async ({ cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })
    cleanup(() => connection.quit())
    await pEvent(connection, 'ready')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        connection.psubscribe('user:*', () => reject('Not expected to be called'))
        setTimeout(() => {
          resolve()
        }, 1500)
      }),
      pEvent(connection, 'psubscription:ready').then(() => {
        return connection.punsubscribe('user:*').then(() => {
          connection.publish('user:add', JSON.stringify({ username: 'virk' }))
        })
      }),
    ])
  }).timeout(4000)

  test('emit ready on subscriber connection', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    cleanup(() => connection.quit())
    connection.subscribe('foo', () => {})

    await pEvent(connection, 'subscriber:ready')
    assert.equal(connection.subscriberStatus, 'ready')
  })

  test('emit error when unable to make subscriber connection', async ({ assert, cleanup }) => {
    const connection = new RedisConnection('main', { port: 4444 })
    await pEvent(connection, 'error')
    cleanup(() => connection.disconnect())

    connection.subscribe('foo', () => {})
    const response = await pEvent(connection, 'subscriber:error')
    assert.equal(response!.error.message, 'connect ECONNREFUSED 127.0.0.1:4444')
  })

  test('cleanup subscribers listeners on quit', async ({ assert }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    connection.subscribe('foo', () => {})
    await pEvent(connection, 'subscriber:ready')
    await pEvent(connection, 'subscription:ready')

    await Promise.all([pEvent(connection, 'subscriber:end'), connection.quit()])
    assert.isUndefined(connection.ioSubscriberConnection)
  })

  test('cleanup subscribers listeners on disconnect', async ({ assert }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    connection.subscribe('foo', () => {})
    await pEvent(connection, 'subscriber:ready')
    await pEvent(connection, 'subscription:ready')

    await Promise.all([pEvent(connection, 'subscriber:end'), connection.disconnect()])
    assert.isUndefined(connection.ioSubscriberConnection)
  })

  test('get subscriber status', async ({ assert }) => {
    const connection = new RedisConnection('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    })

    assert.isUndefined(connection.subscriberStatus)

    connection.subscribe('foo', () => {})
    await pEvent(connection, 'subscriber:ready')
    await pEvent(connection, 'subscription:ready')

    assert.equal(connection.subscriberStatus, 'ready')
  })
})
