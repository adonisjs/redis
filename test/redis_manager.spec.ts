import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/core/factories/app'
import { RedisManagerFactory } from '../factories/redis_manager.js'
import { RedisClusterConnectionAugmented, RedisConnectionAugmented } from '../src/types/main.js'

const clusterNodes = process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
  return { host: process.env.REDIS_HOST!, port: Number(port) }
})

export const BASE_URL = new URL('./tmp/', import.meta.url)

test.group('Redis Manager', () => {
  test('.connection() types should be inferrred from config', async ({ expectTypeOf }) => {
    const app = new AppFactory().create(BASE_URL, () => {})
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        secondary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create(app)

    expectTypeOf(redis.connection).parameter(0).toEqualTypeOf<'primary' | 'secondary' | undefined>()
  })

  test('run redis commands using default connection', async ({ assert }) => {
    const app = new AppFactory().create(BASE_URL, () => {})
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create(app)

    await redis.set('greeting', 'hello-world')
    const greeting = await redis.get('greeting')

    assert.equal(greeting, 'hello-world')

    await redis.del('greeting')
    await redis.quit('primary')
  })

  test('should trigger a ready event when connection is ready', async ({ assert }, done) => {
    const app = new AppFactory().create(BASE_URL, () => {})
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create(app)

    redis.connection().on('ready', async () => {
      assert.isTrue(true)
      await redis.quit()
      done()
    })
  })
    .waitForDone()
    .timeout(5000)

  test('run redis commands using the connection method', async ({ assert }) => {
    const app = new AppFactory().create(BASE_URL, () => {})
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create(app)

    await redis.connection().set('greeting', 'hello-world')
    const greeting = await redis.connection().get('greeting')
    assert.equal(greeting, 'hello-world')

    await redis.connection().del('greeting')
    await redis.quit('primary')
  })

  test('re-use connection when connection method is called', async ({ assert }) => {
    const app = new AppFactory().create(BASE_URL, () => {})
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create(app)

    assert.deepEqual(redis.connection(), redis.connection())
    await redis.quit()
  })

  test('connect to redis cluster when cluster array is defined', async ({ assert }, done) => {
    const app = new AppFactory().create(BASE_URL, () => {})

    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
        cluster: { clusters: clusterNodes },
      },
    }).create(app)

    redis.connection('cluster').on('ready', async () => {
      assert.isAbove(redis.connection('cluster').nodes().length, 2)
      await redis.quit()
      done()
    })
  }).waitForDone()

  test('on disconnect clear connection from tracked list', async ({ assert }, done) => {
    const app = new AppFactory().create(BASE_URL, () => {})
    const redis = new RedisManagerFactory({
      connection: 'primary',
      connections: {
        primary: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
      },
    }).create(app)

    const connection = redis.connection()
    connection.on('end', () => {
      assert.equal(redis.activeConnectionsCount, 0)
      done()
    })

    connection.on('ready', async () => {
      await redis.quit()
    })
  }).waitForDone()

  test('get report for connections marked for healthChecks', async ({ assert }) => {
    const redis = new RedisManagerFactory({
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
    }).create(new AppFactory().create(BASE_URL, () => {}))

    const report = await redis.report()
    assert.deepEqual(report.health, { healthy: true, message: 'All connections are healthy' })
    assert.lengthOf(report.meta, 1)
    assert.isDefined(report.meta[0].used_memory)
    assert.equal(report.meta[0].status, 'ready')
    await redis.quit()
  })

  test('generate correct report when one of the connections are broken', async ({ assert }) => {
    const redis = new RedisManagerFactory({
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
    }).create(new AppFactory().create(BASE_URL, () => {}))

    const report = await redis.report()

    assert.deepEqual(report.health, {
      healthy: false,
      message: 'One or more redis connections are not healthy',
    })
    assert.lengthOf(report.meta, 2)
    await redis.quit()
  })

  test('use pub/sub using the manager instance', async ({ assert }, done) => {
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
    }).create(new AppFactory().create(BASE_URL, () => {}))

    redis.connection().on('subscription:ready', () => {
      redis.publish('news', 'breaking news at 9')
    })

    redis.subscribe('news', async (message) => {
      assert.equal(message, 'breaking news at 9')
      await redis.quit()
      done()
    })
  }).waitForDone()

  test('execute redis commands using lua scripts', async ({ assert }) => {
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
    }).create(new AppFactory().create(BASE_URL, () => {}))

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

    await redis.del('greeting')
    await redis.quit()
  })

  test('get and delete the key', async ({ assert }) => {
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
    }).create(new AppFactory().create(BASE_URL, () => {}))

    await redis.set('greeting', 'hello-world')

    assert.equal(await redis.getdel('greeting'), 'hello-world')
    assert.isNull(await redis.get('greeting'))

    await redis.quit('primary')
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
    }).create(new AppFactory().create(BASE_URL, () => {}))

    expectTypeOf(redis.connection('cluster')).toEqualTypeOf<RedisClusterConnectionAugmented>()
    expectTypeOf(redis.connection('primary')).toEqualTypeOf<RedisConnectionAugmented>()
  })
})
