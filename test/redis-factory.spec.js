'use strict'

/**
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/
const RedisFactory = require('../src/RedisFactory')
const chai = require('chai')
const expect = chai.expect
require('co-mocha')

describe('RedisFactory', function () {
  it('should setup connection with redis', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.once('connect', function () {
      redis.quit(done)
    })
  })

  it('should use proxy to call command over redis client', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.set('foo', 'bar')
    const foo = yield redis.get('foo')
    expect(foo).to.equal('bar')
    redis.quit()
  })

  it('should proxy ioredis connect event', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.on('connect', function () {
      redis.quit(done)
    })
  })

  it('should proxy ioredis error event', function (done) {
    const redis = new RedisFactory({port: 6389, host: 'localhost', retryStrategy: function () { return null }})
    redis.on('error', function (error) {
      expect(error.code).to.equal('ECONNREFUSED')
      done()
    })
  })

  it('should be able to set/get buffer', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.set('foo', new Buffer('bar'))
    const foo = yield redis.getBuffer('foo')
    expect(foo instanceof Buffer).to.equal(true)
    redis.quit()
  })

  it('should be able to pub/sub', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.subscribe('new:user', function * (message) {
      expect(message).to.equal('virk')
      redis.quit(done)
    }).done(function () {
      redis.publish('new:user', 'virk')
    })
  })

  it('should throw error when subscriber handler is not defined', function () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    const fn = function () {
      return redis.subscribe('bar')
    }
    expect(fn).to.throw(/subscriber needs a handler to listen for new messages/)
  })

  it('should not listen to messages on different channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.subscribe('bar', function * (message, channel) {
      expect(channel).to.equal('bar')
      redis.unsubscribe('bar', function () {})
      redis.quit(done)
    }).done(function () {
      redis.publish('foo', 'baz')
      redis.publish('bar', 'baz')
    })
  })

  it('should be able to subscribe to multiple channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    let x = 0
    redis.subscribe('foo', 'bar', function * (message, channel) {
      x++
      expect(channel).to.be.oneOf(['foo', 'bar'])
      if (x === 2) {
        redis.unsubscribe('foo', 'bar', function () {})
        redis.quit(done)
      }
    }).done(function () {
      redis.publish('foo', 'baz')
      redis.publish('bar', 'baz')
    })
  })

  it('should be able to pipe commands', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    const pipe = redis.pipeline()
    const currentTime = new Date().getTime()
    pipe.set('time', currentTime)
    pipe.get('time')
    const result = yield pipe.exec()
    expect(result[1][1]).to.equal(currentTime.toString())
    redis.quit()
  })

  it('should remove subscriber for a given channel when unsubscribe method is called', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.subscribe('bar', 'foo', function * (message, channel) {
      expect(channel).to.equal('bar')
      redis.unsubscribe('bar', function () {})
      expect(redis.subscribers.length).to.equal(1)
      redis.quit(done)
    }).done(function () {
      redis.publish('bar', 'Hello')
    })
  })

  it('should remove multiple subscribers for a given channel when unsubscribe method is called', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.subscribe('bar', 'foo', function * (message, channel) {
      expect(channel).to.equal('bar')
      redis.unsubscribe('bar', 'foo')
      expect(redis.subscribers.length).to.equal(0)
      redis.quit(done)
    }).done(function () {
      redis.publish('bar', 'Hello')
    })
  })

  it('should remove subscribers using unsubscribe when last argument is not a callback', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.subscribe('bar', function * (message, channel) {
      try {
        expect(channel).to.equal('bar')
        redis.unsubscribe('bar')
        expect(redis.subscribers.length).to.equal(0)
        redis.quit(done)
      } catch (e) {
        done(e)
      }
    }).done(function () {
      redis.publish('bar', 'Hello')
    })
  })

  it('should be able to psubscribe to a pattern', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.psubscribe('h?llo', function * (message, channel, pattern) {
      expect(message).to.equal('virk')
      expect(channel).to.equal('hello')
      expect(pattern).to.equal('h?llo')
      redis.punsubscribe('h?llo')
      redis.quit(done)
    }).done(function () {
      redis.publish('hello', 'virk')
    })
  })

  it('should be able to unsubscribe from a pattern subscription', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.psubscribe('h?llo', function * (message, channel, pattern) {
      redis.punsubscribe('h?llo')
      expect(redis.psubscribers.length).to.equal(0)
      redis.quit(done)
    }).done(function () {
      redis.publish('hello', 'virk')
    })
  })

  it('should be able to pattern subscribe to multiple patterns', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    let messagesCount = 0
    redis.psubscribe('h?llo', 'f?eak', function * (message, channel, pattern) {
      messagesCount++
      expect(pattern).to.be.oneOf(['h?llo', 'f?eak'])
      expect(message).to.equal('virk')
      if (messagesCount === 2) {
        redis.punsubscribe('h?llo')
        redis.punsubscribe('f?eak')
        redis.quit(done)
      }
    }).done(function () {
      redis.publish('hello', 'virk')
      redis.publish('freak', 'virk')
    })
  })

  it('should return 0 as count when trying to unsubscribe from unknown channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.unsubscribe('bar', function (err, counts) {
      expect(err).not.to.exist
      expect(counts).to.equal(0)
      done()
    })
  })

  it('should return 0 as count when trying to punsubscribe from unknown channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.punsubscribe('bar', function (err, counts) {
      expect(err).not.to.exist
      expect(counts).to.equal(0)
      done()
    })
  })

  it('should be able to pipeline commands', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    const results = yield redis.pipeline().set('foo', 'bar').get('foo').exec()
    expect(results).deep.equal([[null, 'OK'], [null, 'bar']])
  })
})
