/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../adonis-typings/redis.ts" />

import { test } from '@japa/runner'
import { Application } from '@adonisjs/core/build/standalone'
import { RedisConnectionContract } from '@ioc:Adonis/Addons/Redis'

import { RedisConnection } from '../src/RedisConnection'

test.group('Redis factory', () => {
  test('emit ready when connected to redis server', ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('error', async (error) => {
      console.log(error)
    })

    factory.on('ready', async () => {
      assert.isTrue(true)
      await factory.quit()
      done()
    })
  }).waitForDone()

  test('execute redis commands', async ({ assert }) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    await factory.set('greeting', 'hello world')

    const greeting = await factory.get('greeting')
    assert.equal(greeting, 'hello world')

    await factory.del('greeting')
    await factory.quit()
  })

  test('clean event listeners on quit', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('end', () => {
      assert.equal(factory.ioConnection.listenerCount('ready'), 0)
      assert.equal(factory.ioConnection.listenerCount('end'), 0)
      done()
    })

    factory.on('ready', async () => {
      await factory.quit()
    })
  }).waitForDone()

  test('clean event listeners on disconnect', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('end', () => {
      assert.equal(factory.ioConnection.listenerCount('ready'), 0)
      assert.equal(factory.ioConnection.listenerCount('end'), 0)
      done()
    })

    factory.on('ready', async () => {
      await factory.quit()
    })
  }).waitForDone()

  test('get event for connection errors', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      { port: 4444 },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('end', () => {
      assert.equal(factory.ioConnection.listenerCount('ready'), 0)
      assert.equal(factory.ioConnection.listenerCount('end'), 0)
      done()
    })

    factory.on('error', async (error) => {
      assert.equal(error.code, 'ECONNREFUSED')
      assert.equal(error.port, 4444)
      await factory.quit()
    })
  }).waitForDone()

  test('get report for connected connection', async ({ assert }, done) => {
    assert.plan(5)

    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('end', () => {
      assert.equal(factory.ioConnection.listenerCount('ready'), 0)
      assert.equal(factory.ioConnection.listenerCount('end'), 0)
      done()
    })

    factory.on('ready', async () => {
      const report = await factory.getReport(true)

      assert.equal(report.status, 'ready')
      assert.isNull(report.error)
      assert.isDefined(report.used_memory)

      await factory.quit()
    })
  }).waitForDone()

  test('get report for errored connection', async ({ assert }, done) => {
    assert.plan(5)

    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: 4444,
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('end', () => {
      assert.equal(factory.ioConnection.listenerCount('ready'), 0)
      assert.equal(factory.ioConnection.listenerCount('end'), 0)
      done()
    })

    factory.on('error', async () => {
      const report = await factory.getReport(true)

      assert.notEqual(report.status, 'ready')
      assert.equal(report.error.code, 'ECONNREFUSED')
      assert.equal(report.used_memory, null)

      await factory.quit()
    })
  }).waitForDone()

  test('execute redis commands using lua scripts', async ({ assert }) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.defineCommand('defineValue', {
      numberOfKeys: 1,
      lua: `redis.call('set', KEYS[1], ARGV[1])`,
    })

    factory.defineCommand('readValue', {
      numberOfKeys: 1,
      lua: `return redis.call('get', KEYS[1])`,
    })

    await factory.runCommand('defineValue', 'greeting', 'hello world')
    const greeting = await factory.runCommand('readValue', 'greeting')
    assert.equal(greeting, 'hello world')

    await factory.del('greeting')
    await factory.quit()
  })
})

test.group('Redis factory - Subscribe', () => {
  test('emit subscriber events when subscriber connection is created', async ({}, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('subscriber:ready', async () => {
      await factory.quit()
      done()
    })

    factory.subscribe('news', () => {})
  }).waitForDone()

  test('emit subscription event when subscription is created', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('subscription:ready', async (count) => {
      assert.equal(count, 1)
      await factory.quit()
      done()
    })

    factory.subscribe('news', () => {})
  }).waitForDone()

  test('make multiple subscriptions to different channels', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    let invokedCounts = 0

    factory.on('subscription:ready', async (count) => {
      invokedCounts++

      if (invokedCounts === 2) {
        assert.equal(count, 2)
        await factory.quit()
        done()
      } else {
        assert.equal(count, 1)
      }
    })

    factory.subscribe('news', () => {})
    factory.subscribe('sports', () => {})
  }).waitForDone()

  test('publish messages', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.subscribe('news', async (message) => {
      assert.equal(message, 'breaking news at 9')
      await factory.quit()
      done()
    })

    factory.on('subscription:ready', () => {
      factory.publish('news', 'breaking news at 9')
    })
  }).waitForDone()

  test('publish messages to multiple channels', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('subscription:ready', (count) => {
      if (count === 1) {
        factory.publish('news', 'breaking news at 9')
      }
    })

    factory.subscribe('news', (message) => {
      assert.equal(message, 'breaking news at 9')
      factory.publish('sports', 'india won the cup')
    })

    factory.subscribe('sports', async (message) => {
      assert.equal(message, 'india won the cup')
      await factory.quit()
      done()
    })
  }).waitForDone()

  test('unsubscribe from a channel', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('subscription:ready', () => {
      factory.publish('news', 'breaking news at 9')
    })

    factory.subscribe('news', (message) => {
      assert.equal(message, 'breaking news at 9')
      factory.unsubscribe('news')

      factory.publish('news', 'breaking news at 9', (_error, count) => {
        assert.equal(count, 0)
        done()
      })
    })
  }).waitForDone()

  test('consume messages not stringified using message builder', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.subscribe('news', async (message) => {
      assert.equal(message, 'breaking news at 9')
      await factory.quit()
      done()
    })

    factory.on('subscription:ready', () => {
      factory.ioConnection.publish('news', 'breaking news at 9')
    })
  }).waitForDone()

  test('consume messages self stringified with message sub property', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.subscribe('news', async (message) => {
      assert.equal(message, JSON.stringify({ message: 'breaking news at 9' }))
      await factory.quit()
      done()
    })

    factory.on('subscription:ready', () => {
      factory.ioConnection.publish('news', JSON.stringify({ message: 'breaking news at 9' }))
    })
  }).waitForDone()
})

test.group('Redis factory - PSubscribe', () => {
  test('emit subscriber events when subscriber connection is created', async ({}, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.on('subscriber:ready', async () => {
      await factory.quit()
      done()
    })

    factory.psubscribe('news:*', () => {})
  }).waitForDone()

  test('emit subscription event when subscription is created', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.on('psubscription:ready', async (count) => {
      assert.equal(count, 1)
      await factory.quit()
      done()
    })

    factory.psubscribe('news:*', () => {})
  }).waitForDone()

  test('make multiple subscriptions to different patterns', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    let invokedCounts = 0

    factory.on('psubscription:ready', async (count) => {
      invokedCounts++

      if (invokedCounts === 2) {
        assert.equal(count, 2)
        await factory.quit()
        done()
      } else {
        assert.equal(count, 1)
      }
    })

    factory.psubscribe('news:*', () => {})
    factory.psubscribe('sports:*', () => {})
  }).waitForDone()

  test('publish messages', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.psubscribe('news:*', async (channel, message) => {
      assert.equal(channel, 'news:prime')
      assert.equal(message, 'breaking news at 9')
      await factory.quit()
      done()
    })

    factory.on('psubscription:ready', () => {
      factory.publish('news:prime', 'breaking news at 9')
    })
  }).waitForDone()

  test('publish messages to multiple channels', async ({ assert }, done) => {
    assert.plan(2)
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('psubscription:ready', (count) => {
      if (count === 1) {
        factory.publish('news:prime', 'breaking news at 9')
      }
    })

    factory.psubscribe('news:*', async (channel, message) => {
      if (channel === 'news:prime') {
        assert.equal(message, 'breaking news at 9')
        factory.publish('news:breakfast', 'celebrating marathon')
      }

      if (channel === 'news:breakfast') {
        assert.equal(message, 'celebrating marathon')
        await factory.quit()
        done()
      }
    })
  }).waitForDone()

  test('unsubscribe from a pattern', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract

    factory.on('psubscription:ready', () => {
      factory.publish('news:prime', JSON.stringify({ title: 'breaking news at 9' }))
    })

    factory.psubscribe('news:*', (channel, message) => {
      assert.equal(channel, 'news:prime')
      assert.deepEqual(message, JSON.stringify({ title: 'breaking news at 9' }))
      factory.punsubscribe('news:*')

      factory.publish('news:prime', 'breaking news at 9', (_error, count) => {
        assert.equal(count, 0)
        done()
      })
    })
  }).waitForDone()

  test('bind IoC container binding as subscriber', async ({ assert }, done) => {
    const app = new Application(__dirname, 'web', {})
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      app
    ) as unknown as RedisConnectionContract

    class RedisListeners {
      public async onNews(channel: string, message: string) {
        assert.equal(channel, 'news:prime')
        assert.equal(message, JSON.stringify({ title: 'breaking news at 9' }))
        await factory.quit()
        done()
      }
    }

    app.container.bind('App/Listeners/RedisListeners', () => {
      return new RedisListeners()
    })

    factory.psubscribe('news:*', 'RedisListeners.onNews')

    factory.on('psubscription:ready', () => {
      factory.publish('news:prime', JSON.stringify({ title: 'breaking news at 9' }))
    })
  }).waitForDone()

  test('consume messages not stringified using message builder', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.psubscribe('news:*', async (channel, message) => {
      assert.equal(channel, 'news:prime')
      assert.equal(message, 'breaking news at 9')
      await factory.quit()
      done()
    })

    factory.on('psubscription:ready', () => {
      factory.ioConnection.publish('news:prime', 'breaking news at 9')
    })
  }).waitForDone()

  test('consume messages self stringified', async ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new Application(__dirname, 'web', {})
    ) as unknown as RedisConnectionContract
    factory.psubscribe('news:*', async (channel, message) => {
      assert.equal(channel, 'news:prime')
      assert.equal(message, JSON.stringify({ message: 'breaking news at 9' }))
      await factory.quit()
      done()
    })

    factory.on('psubscription:ready', () => {
      factory.ioConnection.publish('news:prime', JSON.stringify({ message: 'breaking news at 9' }))
    })
  }).waitForDone()
})
