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
    assert.throw(fn, /Cannot get redis configuration for undefined connection/)
  })

  test('should return the instance of redis factory when using _getConnection method', (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })
    const connection = new Redis(config, RedisFactory)
    assert.equal(connection.connection() instanceof RedisFactory, true)
  })

  test('should return the instance of redis factory when using connection method', (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    assert.equal(redis.connection() instanceof RedisFactory, true)
  })

  test('should throw error when unable to find config for a given connection', (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const connection = new Redis(config, RedisFactory)
    const fn = () => connection.connection('foo')
    assert.throw(fn, /Cannot get redis configuration for foo connection/)
  })

  test('should proxy redis factory methods', (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    const get = redis.get
    assert.isFunction(get, 'function')
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
    redis.quit()
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
    redis.quit()
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
    redis.quit()
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
      assert.equal(error.code, 'ECONNREFUSED')
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
  })
})
