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

  test('should return the instance of redis factory when using connection method', (assert, done) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const connection = new Redis(config, RedisFactory)
    connection.once('end', done)
    connection.once('connect', () => {
      assert.equal(connection.connection() instanceof RedisFactory, true)
      connection.disconnect()
    })

    connection.connection()
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
  })

  test('should proxy redis factory methods', (assert, done) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    redis.on('end', done)

    redis.once('connect', () => {
      const get = redis.get
      assert.isFunction(get, 'function')
      redis.disconnect()
    })
  })

  test('should be able to connect to redis to set and get data', (assert, done) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    redis.once('end', done)

    redis.once('connect', () => {
      redis.set('foo', 'bar')
      redis
        .get('foo')
        .then((foo) => {
          assert.equal(foo, 'bar')
          redis.disconnect()
        })
        .catch(done)
    })
  })

  test('should reuse the connection pool when trying to access redis for same connection', (assert, done) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    redis.once('end', done)

    redis.once('connect', () => {
      redis
        .set('foo', 'bar')
        .then(() => {
          redis.get('foo')
        })
        .then(() => {
          assert.equal(Object.keys(redis.getConnections()).length, 1)
          assert.property(redis.getConnections(), 'primary')
          redis.disconnect()
        })
        .catch(done)
    })
  })

  test('should close a given connection using quit method', async (assert) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    await redis.set('foo', 'bar')
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

  test('should be able to create a new redis connection using connection method', (assert, done) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 },
      secondary: 'self::redis.primary'
    })

    const redis = new Redis(config, RedisFactory)
    redis.connection('secondary').on('end', done)

    redis.connection('secondary').on('connect', () => {
      redis
        .connection('secondary')
        .set('foo', 'bar')
        .then(() => {
          return redis.connection('secondary').get('foo')
        })
        .then((foo) => {
          assert.equal(foo, 'bar')
          assert.equal(Object.keys(redis.getConnections()).length, 1)
          assert.property(redis.getConnections(), 'secondary')
          redis.connection('secondary').disconnect()
        })
        .catch(done)
    })
  })

  test('return connection and add it to the pool', (assert, done) => {
    const config = new Config()
    config.set('redis', {
      connection: 'primary',
      primary: { host: '127.0.0.1', port: 6379 }
    })

    const redis = new Redis(config, RedisFactory)
    const rawConfig = {
      host: '127.0.0.1', port: 6379
    }

    redis.namedConnection('secondary', rawConfig)
    redis.namedConnection('secondary', rawConfig).on('end', done)

    redis.namedConnection('secondary', rawConfig).on('ready', () => {
      redis
        .connection('secondary')
        .set('foo', 'bar')
        .then(() => {
          return redis.connection('secondary', rawConfig).get('foo')
        })
        .then((foo) => {
          assert.equal(foo, 'bar')
          return redis.client('list')
        })
        .then((connectedClients) => {
          assert.equal(connectedClients.split('\n').filter((line) => line.trim()).length, 2)
          redis.connection('secondary').disconnect()
        })
        .catch(done)
    })
  })
})
