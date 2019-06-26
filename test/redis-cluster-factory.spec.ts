/*
* @adonisjs/redis
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../adonis-typings/redis.ts" />

import * as test from 'japa'
import { RedisClusterFactory } from '../src/RedisClusterFactory'
import { RedisClusterFactoryContract } from '@ioc:Adonis/Addons/Redis'

const nodes = process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
  return { host: process.env.REDIS_HOST!, port: Number(port) }
})

test.group('Redis cluster factory', () => {
  test('emit ready when connected to redis server', (assert, done) => {
    const factory = new RedisClusterFactory({
      cluster: true,
      clusters: nodes,
    }) as unknown as RedisClusterFactoryContract

    factory.on('ready', async () => {
      assert.isTrue(true)
      await factory.quit()
      done()
    })
  })

  test('emit node connection event', (assert, done) => {
    const factory = new RedisClusterFactory({
      cluster: true,
      clusters: [{ host: process.env.REDIS_HOST!!, port: 7000 }],
    }) as unknown as RedisClusterFactoryContract

    factory.on('node:added', async () => {
      assert.isTrue(true)
      await factory.quit()
      done()
    })
  })

  test('execute redis commands', async (assert) => {
    const factory = new RedisClusterFactory({
      cluster: true,
      clusters: nodes,
    }) as unknown as RedisClusterFactoryContract

    await factory.set('greeting', 'hello world')
    const greeting = await factory.get('greeting')
    assert.equal(greeting, 'hello world')

    await factory.del('greeting')
    await factory.quit()
  })

  test('clean event listeners on quit', async (assert, done) => {
    const factory = new RedisClusterFactory({
      cluster: true,
      clusters: nodes,
    }) as unknown as RedisClusterFactoryContract

    factory.on('end', () => {
      assert.equal(factory.connection.listenerCount('ready'), 0)
      assert.equal(factory.connection.listenerCount('end'), 0)
      done()
    })

    factory.on('ready', async () => {
      await factory.quit()
    })
  })

  test('clean event listeners on disconnect', async (assert, done) => {
    const factory = new RedisClusterFactory({
      cluster: true,
      clusters: nodes,
    }) as unknown as RedisClusterFactoryContract

    factory.on('end', () => {
      assert.equal(factory.connection.listenerCount('ready'), 0)
      assert.equal(factory.connection.listenerCount('end'), 0)
      done()
    })

    factory.on('ready', async () => {
      await factory.disconnect()
    })
  })

  test('get event for connection errors', async (assert, done) => {
    const factory = new RedisClusterFactory({
      cluster: true,
      clusters: [{ host: process.env.REDIS_HOST!, port: 5000 }],
    }) as unknown as RedisClusterFactoryContract

    factory.on('end', () => {
      assert.equal(factory.connection.listenerCount('ready'), 0)
      assert.equal(factory.connection.listenerCount('end'), 0)
      done()
    })

    /**
     * `error` event is also emitted
     */
    factory.on('node:error', async () => {
      await factory.quit()
    })
  })
})
