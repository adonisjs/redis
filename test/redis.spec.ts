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
import { RedisContract } from '@ioc:Adonis/Addons/Redis'

import { Redis } from '../src/Redis'

test.group('Redis', () => {
  test('run redis commands using default connection', async (assert, done) => {
    const redis = new Redis(new Ioc(), {
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
        },
      },
    } as any) as unknown as RedisContract

    await redis.connection().set('greeting', 'hello-world')
    const greeting = await redis.connection().get('greeting')
    assert.equal(greeting, 'hello-world')

    redis.on('end', () => {
      done()
    })

    await redis.connection().del('greeting')
    await redis.quit('primary')
  })

  test('re-use connection when connection method is called', async (assert, done) => {
    const redis = new Redis(new Ioc(), {
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
        },
      },
    } as any) as unknown as RedisContract

    redis.on('end', () => {
      done()
    })

    assert.deepEqual(redis.connection(), redis.connection('primary'))
    await redis.quit()
  })

  test('connect to redis cluster when cluster array is defined', async (assert, done) => {
    const redis = new Redis(new Ioc(), {
      connection: 'primary',
      connections: {
        primary: {
          clusters: process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
            return { host: process.env.REDIS_HOST!, port: Number(port) }
          }),
        },
      },
    } as any) as unknown as RedisContract

    redis.on('end', () => {
      done()
    })

    redis.connection().on('ready', async () => {
      assert.equal(redis.connection().nodes().length, 6)
      await redis.quit()
    })
  })

  test('on disconnect clear connection from tracked list', async (assert, done) => {
    const redis = new Redis(new Ioc(), {
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
        },
      },
    } as any) as unknown as RedisContract

    const connection = redis.connection()
    connection.on('end', () => {
      assert.lengthOf(Object.keys(redis['_connectionPools']), 0)
      done()
    })

    connection.on('ready', async () => {
      await redis.quit()
    })
  })

  test('get report for connections marked for healthChecks', async (assert, done) => {
    const redis = new Redis(new Ioc(), {
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
          healthCheck: true,
        },
        secondary: {
          host: process.env.REDIS_HOST,
          port: 4444,
        },
      },
    } as any)

    redis.on('end', () => {
      done()
    })

    const report = await redis.report()
    assert.deepEqual(report.health, { healthy: true, message: 'All connections are healthy' })
    assert.lengthOf(report.meta, 1)
    assert.isDefined(report.meta[0].used_memory)
    assert.equal(report.meta[0].status, 'ready')
    await redis.quit()
  })

  test('generate correct report when one of the connections are broken', async (assert, done) => {
    const redis = new Redis(new Ioc(), {
      connection: 'primary',
      connections: {
        primary: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
          healthCheck: true,
        },
        secondary: {
          host: process.env.REDIS_HOST,
          healthCheck: true,
          port: 4444,
        },
      },
    } as any)

    redis.on('end', () => {
      done()
    })

    const report = await redis.report()

    assert.deepEqual(report.health, {
      healthy: false,
      message: 'One or more redis connections are not healthy',
    })
    assert.lengthOf(report.meta, 2)
    await redis.quit()
  })
})
