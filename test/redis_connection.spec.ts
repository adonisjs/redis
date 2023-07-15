import RedisConnection from '../src/redis_connection.js'
import { test } from '@japa/runner'
import { BASE_URL } from './redis_manager.spec.js'
import { AppFactory } from '@adonisjs/core/factories/app'

test.group('Redis factory', () => {
  test('emit ready when connected to redis server', ({ assert }, done) => {
    const factory = new RedisConnection(
      'main',
      {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      new AppFactory().create(BASE_URL, () => {}),
    )

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
      new AppFactory().create(BASE_URL, () => {}),
    )

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
      new AppFactory().create(BASE_URL, () => {}),
    )

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
      new AppFactory().create(BASE_URL, () => {}),
    )

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
      new AppFactory().create(BASE_URL, () => {}),
    )

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
      new AppFactory().create(BASE_URL, () => {}),
    )

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
      new AppFactory().create(BASE_URL, () => {}),
    )

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
      new AppFactory().create(BASE_URL, () => {}),
    )

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
