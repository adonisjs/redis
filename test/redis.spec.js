'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const test = require('japa')
const { Config } = require('@adonisjs/sink')
const Redis = require('../src/Redis')
const RedisFactory = require('../src/RedisFactory')

test.group('Redis', () => {
  test('should throw exception when connection is not defined in redis config file', (assert) => {
    const connection = new Redis(new Config(), RedisFactory)
    const fn = () => connection._getConfig()
    assert.throw(fn, 'E_MISSING_CONFIG: configuration for redis is not defined inside config/redis.js file')
  })

  test('should return the instance of redis factory when using _getConnection method', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })
    const connection = new Redis(config, RedisFactory)
    assert.equal(connection.connection() instanceof RedisFactory, true)
    await connection.quit('primary')
  })

  test('should return the instance of redis factory when using connection method', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    assert.equal(redis.connection() instanceof RedisFactory, true)
    await redis.quit('primary')
  })

  test('should throw error when unable to find config for a given connection', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const connection = new Redis(config, RedisFactory)
    const fn = () => connection.connection('foo')
    assert.throw(fn, 'E_MISSING_CONFIG: foo is not defined inside config/redis.js file')

    await connection.quit('primary')
  })

  test('should proxy redis factory methods', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    const get = redis.get
    assert.isFunction(get, 'function')

    await redis.quit('primary')
  })

  test('should be able to connect to redis to set and get data', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    redis.set('foo', 'bar')
    const foo = await redis.get('foo')
    assert.equal(foo, 'bar')

    await redis.quit('primary')
  })

  test('should reuse the connection pool when trying to access redis for same connection', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    redis.set('foo', 'bar')
    await redis.get('foo')
    assert.equal(Object.keys(redis.getConnections()).length, 1)
    assert.property(redis.getConnections(), 'primary')

    await redis.quit('primary')
  })

  test('should close a given connection using quit method', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    redis.set('foo', 'bar')
    const response = await redis.quit('primary')
    assert.deepEqual(response, [['OK']])
    assert.equal(Object.keys(redis.getConnections()).length, 0)
  })

  test('should throw an error event when unable to connect to redis', function (assert, done) {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6389 },
      secondary: 'self::redis.primary'
    })

    const redis = new Redis(config, RedisFactory)

    redis.on('error', (error) => {
      redis.disconnect()
      assert.equal(error.code, 'ECONNREFUSED')
    })

    redis.on('end', () => {
      done()
    })
  })

  test('should be able to create a new redis connection using connection method', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 },
      secondary: 'self::redis.primary'
    })

    const redis = new Redis(config, RedisFactory)
    redis.connection('secondary').set('foo', 'bar')
    const foo = await redis.connection('secondary').get('foo')
    assert.equal(foo, 'bar')
    assert.equal(Object.keys(redis.getConnections()).length, 1)
    assert.property(redis.getConnections(), 'secondary')

    await redis.quit('primary')
    await redis.quit('secondary')
  })

  test('return connection and add it to the pool', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    const rawConfig = {
      host: '127.0.0.1', port: 6379
    }

    await redis.namedConnection('secondary', rawConfig).set('foo', 'bar')
    const foo = await redis.namedConnection('secondary', rawConfig).get('foo')
    assert.equal(foo, 'bar')

    const connectedClients = await redis.client('list')
    assert.equal(connectedClients.split('\n').filter((line) => line.trim()).length, 2)
  })
})
