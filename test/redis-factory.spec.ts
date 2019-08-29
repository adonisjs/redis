/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../adonis-typings/redis.ts" />

import test from 'japa'
import { Ioc } from '@adonisjs/fold'
import { RedisFactory } from '../src/RedisFactory'
import { RedisFactoryContract } from '@ioc:Adonis/Addons/Redis'

test.group('Redis factory', () => {
  test('emit ready when connected to redis server', (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

    factory.on('error', async (error) => {
      console.log(error)
    })

    factory.on('ready', async () => {
      assert.isTrue(true)
      await factory.quit()
      done()
    })
  })

  test('execute redis commands', async (assert) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

    await factory.set('greeting', 'hello world')

    const greeting = await factory.get('greeting')
    assert.equal(greeting, 'hello world')

    await factory.del('greeting')
    await factory.quit()
  })

  test('clean event listeners on quit', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

    factory.on('end', () => {
      assert.equal(factory.ioConnection.listenerCount('ready'), 0)
      assert.equal(factory.ioConnection.listenerCount('end'), 0)
      done()
    })

    factory.on('ready', async () => {
      await factory.quit()
    })
  })

  test('clean event listeners on disconnect', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

    factory.on('end', () => {
      assert.equal(factory.ioConnection.listenerCount('ready'), 0)
      assert.equal(factory.ioConnection.listenerCount('end'), 0)
      done()
    })

    factory.on('ready', async () => {
      await factory.quit()
    })
  })

  test('get event for connection errors', async (assert, done) => {
    const factory = new RedisFactory('main', { port: 4444 }) as unknown as RedisFactoryContract

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
  })
})

test.group('Redis factory - Subscribe', () => {
  test('emit subscriber events when subscriber connection is created', async (_assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
    factory.on('subscriber:ready', async () => {
      await factory.quit()
      done()
    })

    factory.subscribe('news', () => {})
  })

  test('emit subscription event when subscription is created', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
    factory.on('subscription:ready', async (count) => {
      assert.equal(count, 1)
      await factory.quit()
      done()
    })

    factory.subscribe('news', () => {})
  })

  test('make multiple subscriptions to different channels', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
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
  })

  test('publish messages', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
    factory.subscribe('news', async (message) => {
      assert.equal(message, 'breaking news at 9')
      await factory.quit()
      done()
    })

    factory.on('subscription:ready', () => {
      factory.publish('news', 'breaking news at 9')
    })
  })

  test('publish messages to multiple channels', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

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
  })

  test('unsubscribe from a channel', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

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
  })
})

test.group('Redis factory - PSubscribe', () => {
  test('emit subscriber events when subscriber connection is created', async (_assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
    factory.on('subscriber:ready', async () => {
      await factory.quit()
      done()
    })

    factory.psubscribe('news:*', () => {})
  })

  test('emit subscription event when subscription is created', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
    factory.on('psubscription:ready', async (count) => {
      assert.equal(count, 1)
      await factory.quit()
      done()
    })

    factory.psubscribe('news:*', () => {})
  })

  test('make multiple subscriptions to different patterns', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
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
  })

  test('publish messages', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract
    factory.psubscribe('news:*', async (channel, message) => {
      assert.equal(channel, 'news:prime')
      assert.equal(message, 'breaking news at 9')
      await factory.quit()
      done()
    })

    factory.on('psubscription:ready', () => {
      factory.publish('news:prime', 'breaking news at 9')
    })
  })

  test('publish messages to multiple channels', async (assert, done) => {
    assert.plan(2)
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

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
  })

  test('unsubscribe from a pattern', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

    factory.on('psubscription:ready', () => {
      factory.publish('news:prime', 'breaking news at 9')
    })

    factory.psubscribe('news:*', (channel, message) => {
      assert.equal(channel, 'news:prime')
      assert.equal(message, 'breaking news at 9')
      factory.punsubscribe('news:*')

      factory.publish('news:prime', 'breaking news at 9', (_error, count) => {
        assert.equal(count, 0)
        done()
      })
    })
  })

  test('bind IoC container binding as subscriber', async (assert, done) => {
    const factory = new RedisFactory('main', {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }) as unknown as RedisFactoryContract

    class RedisListeners {
      public async onNews (channel: string, message: string) {
        assert.equal(channel, 'news:prime')
        assert.equal(message, 'breaking news at 9')
        await factory.quit()
        done()
      }
    }

    const ioc = new Ioc()
    ioc.bind('App/Listeners/RedisListeners', () => {
      return new RedisListeners()
    })
    global[Symbol.for('ioc.make')] = ioc.make.bind(ioc)
    global[Symbol.for('ioc.call')] = ioc.call.bind(ioc)

    factory.psubscribe('news:*', 'RedisListeners.onNews')

    factory.on('psubscription:ready', () => {
      factory.publish('news:prime', 'breaking news at 9')
    })
  })
})
