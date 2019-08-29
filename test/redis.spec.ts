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
import { RedisContract } from '@ioc:Adonis/Addons/Redis'

import { Redis } from '../src/Redis'

test.group('Redis', () => {
  test('run redis commands using default connection', async (assert) => {
    const redis = new Redis({
      connection: 'primary',
      primary: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    }) as unknown as RedisContract

    await redis.set('greeting', 'hello-world')
    const greeting = await redis.get('greeting')
    assert.equal(greeting, 'hello-world')

    await redis.del('greeting')
    await redis.quit('primary')
  })

  test('re-use connection when connection method is called', async (assert) => {
    const redis = new Redis({
      connection: 'primary',
      primary: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    }) as unknown as RedisContract

    assert.deepEqual(redis.connection(), redis.connection('primary'))
    await redis.quit()
  })

  test('connect to redis cluster when cluster array is defined', async (assert, done) => {
    const redis = new Redis({
      connection: 'primary',
      primary: {
        clusters: process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
          return { host: process.env.REDIS_HOST!, port: Number(port) }
        }),
      },
    }) as unknown as RedisContract

    redis.connection().on('ready', async () => {
      assert.equal(redis.connection().nodes().length, 6)
      await redis.quit()
      done()
    })
  })

  test('on disconnect clear connection from tracked list', async (assert, done) => {
    const redis = new Redis({
      connection: 'primary',
      primary: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    }) as unknown as RedisContract

    redis.connection().on('end', () => {
      assert.lengthOf(Object.keys(redis['_connectionPools']), 0)
      done()
    })

    redis.connection().on('ready', async () => {
      await redis.quit()
    })
  })
})
