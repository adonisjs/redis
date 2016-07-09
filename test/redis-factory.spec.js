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
const Ioc = require('adonis-fold').Ioc
const expect = chai.expect
require('co-mocha')

const Helpers = {
  makeNameSpace: function (base, toPath) {
    return `App/${base}/${toPath}`
  }
}

describe('RedisFactory', function () {
  it('should setup connection with redis', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.once('connect', function () {
      redis.quit().then((response) => {
        expect(response).deep.equal(['OK'])
        done()
      }).catch(done)
    })
  })

  it('should use proxy to call command over redis client', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.set('foo', 'bar')
    const foo = yield redis.get('foo')
    expect(foo).to.equal('bar')
    yield redis.quit()
  })

  it('should proxy ioredis error event', function (done) {
    const redis = new RedisFactory({port: 6389, host: 'localhost', retryStrategy: function () { return null }})
    redis.on('error', function (error) {
      expect(error.code).to.equal('ECONNREFUSED')
      done()
    })
  })

  it('should be able to quit redis connection', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const response = yield redis.quit()
    expect(response).deep.equal(['OK'])
  })

  it('should be able to set/get buffer', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.set('foo', new Buffer('bar'))
    const foo = yield redis.getBuffer('foo')
    expect(foo instanceof Buffer).to.equal(true)
    yield redis.quit()
  })

  it('should be able to pub/sub', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.subscribe('new:user', function * (message) {
      expect(message).to.equal('virk')
      yield redis.quit()
      done()
    }).done(function () {
      redis.publish('new:user', 'virk')
    })
  })

  it('should be able to attach normal functions', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.subscribe('new:user', function (message) {
      expect(message).to.equal('virk')
      redis.quit().then(() => done()).catch(done)
    }).done(function () {
      redis.publish('new:user', 'virk')
    })
  })

  it('should be able to define subscriber as an autoload namespace', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const RedisSubscriber = {
      * onNewUser (message) {
        expect(message).to.equal('virk')
        yield redis.quit()
        done()
      }
    }
    Ioc.bind('App/Listeners/Redis', function () {
      return RedisSubscriber
    })
    redis.subscribe('new:user', 'Redis.onNewUser').done(function () {
      redis.publish('new:user', 'virk')
    })
  })

  it('ioc referenced listener should maintain the scope', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const RedisSubscriber = {
      name: 'foo',
      * onNewUser (message) {
        expect(message).to.equal('virk')
        expect(this.name).to.equal('foo')
        yield redis.quit()
        done()
      }
    }
    Ioc.bind('App/Listeners/Redis', function () {
      return RedisSubscriber
    })
    redis.subscribe('new:user', 'Redis.onNewUser').done(function () {
      redis.publish('new:user', 'virk')
    })
  })

  it('should throw error when subscriber handler is not defined', function () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const fn = function () {
      return redis.subscribe('bar', {})
    }
    expect(fn).to.throw(/subscriber needs a handler to listen for new messages/)
  })

  it('should not listen to messages on different channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.subscribe('bar', function * (message, channel) {
      expect(channel).to.equal('bar')
      redis.unsubscribe('bar', function () {})
      yield redis.quit()
      done()
    }).done(function () {
      redis.publish('foo', 'baz')
      redis.publish('bar', 'baz')
    })
  })

  it('should be able to subscribe to multiple channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    let x = 0
    redis.subscribe('foo', 'bar', function * (message, channel) {
      x++
      expect(channel).to.be.oneOf(['foo', 'bar'])
      if (x === 2) {
        redis.unsubscribe('foo', 'bar', function () {})
        yield redis.quit()
        done()
      }
    }).done(function () {
      redis.publish('foo', 'baz')
      redis.publish('bar', 'baz')
    })
  })

  it('should be able to pipe commands', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const pipe = redis.pipeline()
    const currentTime = new Date().getTime()
    pipe.set('time', currentTime)
    pipe.get('time')
    const result = yield pipe.exec()
    expect(result[1][1]).to.equal(currentTime.toString())
    yield redis.quit()
  })

  it('should remove subscriber for a given channel when unsubscribe method is called', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.subscribe('bar', 'foo', function * (message, channel) {
      expect(channel).to.equal('bar')
      redis.unsubscribe('bar', function () {})
      expect(redis.subscribers.length).to.equal(1)
      yield redis.quit()
      done()
    }).done(function () {
      redis.publish('bar', 'Hello')
    })
  })

  it('should remove multiple subscribers for a given channel when unsubscribe method is called', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.subscribe('bar', 'foo', function * (message, channel) {
      expect(channel).to.equal('bar')
      redis.unsubscribe('bar', 'foo')
      expect(redis.subscribers.length).to.equal(0)
      yield redis.quit()
      done()
    }).done(function () {
      redis.publish('bar', 'Hello')
    })
  })

  it('should remove subscribers using unsubscribe when last argument is not a callback', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.subscribe('bar', function * (message, channel) {
      try {
        expect(channel).to.equal('bar')
        redis.unsubscribe('bar')
        expect(redis.subscribers.length).to.equal(0)
        yield redis.quit()
        done()
      } catch (e) {
        done(e)
      }
    }).done(function () {
      redis.publish('bar', 'Hello')
    })
  })

  it('should be able to psubscribe to a pattern', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.psubscribe('h?llo', function * (message, channel, pattern) {
      expect(message).to.equal('virk')
      expect(channel).to.equal('hello')
      expect(pattern).to.equal('h?llo')
      redis.punsubscribe('h?llo')
      yield redis.quit()
      done()
    }).done(function () {
      redis.publish('hello', 'virk')
    })
  })

  it('should be able to psubscribe and attach an autoload path as a listener', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const RedisSubscriber = {
      * onGreeting (message, channel, pattern) {
        expect(message).to.equal('virk')
        expect(channel).to.equal('hello')
        expect(pattern).to.equal('h?llo')
        redis.punsubscribe('h?llo')
        yield redis.quit()
        done()
      }
    }
    Ioc.bind('App/Listeners/Redis', function () {
      return RedisSubscriber
    })
    redis.psubscribe('h?llo', 'Redis.onGreeting').done(function () {
      redis.publish('hello', 'virk')
    })
  })

  it('should be able to psubscribe plain functions', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const RedisSubscriber = {
      onGreeting (message, channel, pattern) {
        expect(message).to.equal('virk')
        expect(channel).to.equal('hello')
        expect(pattern).to.equal('h?llo')
        redis.punsubscribe('h?llo')
        redis.quit().then(() => done()).catch(done)
      }
    }
    Ioc.bind('App/Listeners/Redis', function () {
      return RedisSubscriber
    })
    redis.psubscribe('h?llo', 'Redis.onGreeting').done(function () {
      redis.publish('hello', 'virk')
    })
  })

  it('should be able to unsubscribe from a pattern subscription', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.psubscribe('h?llo', function * (message, channel, pattern) {
      redis.punsubscribe('h?llo')
      expect(redis.psubscribers.length).to.equal(0)
      yield redis.quit()
      done()
    }).done(function () {
      redis.publish('hello', 'virk')
    })
  })

  it('should be able to pattern subscribe to multiple patterns', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    let messagesCount = 0
    redis.psubscribe('h?llo', 'f?eak', function * (message, channel, pattern) {
      messagesCount++
      expect(pattern).to.be.oneOf(['h?llo', 'f?eak'])
      expect(message).to.equal('virk')
      if (messagesCount === 2) {
        redis.punsubscribe('h?llo')
        redis.punsubscribe('f?eak')
        yield redis.quit()
        done()
      }
    }).done(function () {
      redis.publish('hello', 'virk')
      redis.publish('freak', 'virk')
    })
  })

  it('should return 0 as count when trying to unsubscribe from unknown channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.unsubscribe('bar', function (err, counts) {
      expect(err).not.to.exist
      expect(counts).to.equal(0)
      done()
    })
  })

  it('should return 0 as count when trying to punsubscribe from unknown channels', function (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.punsubscribe('bar', function (err, counts) {
      expect(err).not.to.exist
      expect(counts).to.equal(0)
      done()
    })
  })

  it('should be able to pipeline commands', function * () {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    const results = yield redis.pipeline().set('foo', 'bar').get('foo').exec()
    expect(results).deep.equal([[null, 'OK'], [null, 'bar']])
    yield redis.quit()
  })

  it('should close subscriber connection with normal connection when quit is called', function * (done) {
    const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
    redis.subscribe('foo', function * () {})
    const response = yield redis.quit()
    expect(response).deep.equal(['OK', 'OK'])
    setTimeout(function () {
      expect(redis.redis.status).to.equal('end')
      expect(redis.subscriberConnection.status).to.equal('end')
      done()
    })
  })
})
