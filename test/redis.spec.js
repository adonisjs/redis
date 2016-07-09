'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const Redis = require('../src/Redis')
const RedisFactory = require('../src/RedisFactory')
const chai = require('chai')
const expect = chai.expect
const stderr = require('test-console').stderr

require('co-mocha')

const Config = {
  get: function (key) {
    switch (key) {
      case 'redis.connection':
        return 'primary'
      case 'redis.primary':
        return {port: 6379, host: 'localhost'}
      case 'redis.secondary':
        return {port: 6379, host: 'localhost'}
    }
  }
}

describe('Redis', function () {
  it('should throw exception when connection is not defined in redis config file', function () {
    const connection = new Redis({get: function () {}}, RedisFactory)
    const fn = () => connection._getConfig('default')
    expect(fn).to.throw(/Make sure to define a default connection for redis/)
  })

  it('should return the instance of redis factory when using _getConnection method', function () {
    const connection = new Redis(Config, RedisFactory)
    expect(connection._getConnection('default') instanceof RedisFactory).to.equal(true)
  })

  it('should return the instance of redis factory when using connection method', function () {
    const redis = new Redis(Config, RedisFactory)
    expect(redis.connection() instanceof RedisFactory).to.equal(true)
  })

  it('should throw error when unable to find config for a given connection', function () {
    const connection = new Redis(Config, RedisFactory)
    const fn = () => connection._getConnection('foo')
    expect(fn).to.throw(/Cannot get redis configuration for foo connection/)
  })

  it('should proxy redis factory methods', function () {
    const redis = new Redis(Config, RedisFactory)
    const get = redis.get
    expect(get).to.be.a('function')
  })

  it('should be able to connect to redis to set and get data', function * () {
    const redis = new Redis(Config, RedisFactory)
    redis.set('foo', 'bar')
    const foo = yield redis.get('foo')
    expect(foo).to.equal('bar')
    redis.quit()
  })

  it('should reuse the connection pool when trying to access redis for same connection', function * () {
    const redis = new Redis(Config, RedisFactory)
    redis.set('foo', 'bar')
    yield redis.get('foo')
    expect(Object.keys(redis.getConnections()).length).to.equal(1)
    expect(redis.getConnections()).to.have.property('default')
    redis.quit()
  })

  it('should reuse the connection pool when trying to access redis for same connection', function * () {
    const redis = new Redis(Config, RedisFactory)
    redis.set('foo', 'bar')
    yield redis.get('foo')
    expect(Object.keys(redis.getConnections()).length).to.equal(1)
    expect(redis.getConnections()).to.have.property('default')
    redis.quit()
  })

  it('should close a given connection using quit method', function * () {
    const redis = new Redis(Config, RedisFactory)
    redis.set('foo', 'bar')
    const response = yield redis.quit('default')
    expect(response).deep.equal([['OK']])
    expect(Object.keys(redis.getConnections()).length).to.equal(0)
  })

  it('should throw an error event when unable to connect to redis', function (done) {
    const redis = new Redis({get: function () { return {port: 6389, host: 'localhost'} }}, RedisFactory)
    redis.on('error', (error) => {
      expect(error.code).to.equal('ECONNREFUSED')
      done()
    })
  })

  it('should be able to create a new redis connection using connection method', function * () {
    const redis = new Redis(Config, RedisFactory)
    redis.connection('secondary').set('foo', 'bar')
    const foo = yield redis.connection('secondary').get('foo')
    expect(foo).to.equal('bar')
    expect(Object.keys(redis.getConnections()).length).to.equal(1)
    expect(redis.getConnections()).to.have.property('secondary')
  })

  it('should warn when trying to close a non-existing connection', function () {
    const redis = new Redis(Config, RedisFactory)
    const inspect = stderr.inspect()
    redis.quit('default')
    inspect.restore()
    expect(inspect.output[inspect.output.length - 2]).to.match(/trying to close a non-existing redis connection named default/)
  })
})
