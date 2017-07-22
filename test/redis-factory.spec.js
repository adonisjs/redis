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
const { ioc } = require('@adonisjs/fold')
const { setupResolver } = require('@adonisjs/sink')

const RedisFactory = require('../src/RedisFactory')

test.group('RedisFactory', function (group) {
  group.before(() => {
    ioc.restore()
    setupResolver()
  })

  test('should setup connection with redis', (assert, done) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.once('connect', function () {
      redis.quit().then((response) => {
        assert.deepEqual(response, ['OK'])
        done()
      }).catch(done)
    })
  })

  test('should use proxy to call command over redis client', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.set('foo', 'bar')
    const foo = await redis.get('foo')
    assert.equal(foo, 'bar')
    await redis.quit()
  })

  test('should proxy ioredis error event', (assert, done) => {
    const redis = new RedisFactory({port: 6389, host: 'localhost', retryStrategy: function () { return null }})
    redis.on('error', function (error) {
      assert.equal(error.code, 'ECONNREFUSED')
      done()
    })
  })

  test('should be able to quit redis connection', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    const response = await redis.quit()
    assert.deepEqual(response, ['OK'])
  })

  test('should be able to set/get buffer', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.set('foo', Buffer.from('bar'))
    const foo = await redis.getBuffer('foo')
    assert.equal(foo instanceof Buffer, true)
    await redis.quit()
  })

  test('subscribe to a channel', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    await redis.subscribe('news', function () { })
    assert.isDefined(redis.subscribers.news)
    await redis.quit()
  })

  test('subscribing multiple times should throw exception', async (assert) => {
    assert.plan(1)
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    await redis.subscribe('news', function () { })
    try {
      await redis.subscribe('news', function () { })
    } catch ({ message }) {
      assert.equal(message, 'Cannot subscribe to news channel twice')
    }
    await redis.quit()
  })

  test('do not register any subscribers when unable to subscribe', async (assert) => {
    assert.plan(3)
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.subscriberConnection = redis._newConnection()
    try {
      await redis.subscriberConnection.quit()
      await redis.subscribe('news', function () { })
    } catch ({ message }) {
      assert.equal(message, 'Connection is closed.')
      assert.deepEqual(redis.subscribers, {})
      assert.equal(redis.subscriberConnection.listenerCount('message'), 0)
    }
    await redis.quit()
  })

  test('should be able to define subscriber as an autoload namespace', (assert, done) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    const RedisSubscriber = {
      async onNewUser (message) {
        assert.equal(message, 'virk')
        await redis.quit()
        done()
      }
    }

    ioc.fake('App/Listeners/Redis', function () {
      return RedisSubscriber
    })

    redis
    .subscribe('new:user', 'Redis.onNewUser')
    .then(() => {
      redis.publish('new:user', 'virk')
    }).catch(done)
  })

  test('unsubscribe from a channel', (assert, done) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis
    .subscribe('new:user', function () {})
    .then(() => {
      return redis.unsubscribe('new:user')
    }).then(() => {
      setTimeout(() => {
        assert.isUndefined(redis.subscribers['new:user'])
        assert.deepEqual(redis.subscribers, {})
        assert.equal(redis.subscriberConnection.listenerCount('message'), 0)
        assert.equal(redis.subscriberConnection.listenerCount('pmessage'), 0)
        return redis.quit()
      })
    }).then(() => {
      done()
    }).catch(done)
  })

  test('subscribe to a pattern', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    await redis.psubscribe('new?', function () { })
    assert.isDefined(redis.psubscribers['new?'])
    await redis.quit()
  })

  test('receive messages related to a pattern', (assert, done) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis
      .psubscribe('new?', async function (pattern, message, channel) {
        assert.equal(pattern, 'new?')
        assert.equal(message, 'hello')
        assert.equal(channel, 'news')
        await redis.quit()
        done()
      })
      .then(() => {
        redis.publish('news', 'hello')
      })
  })

  test('unsubscribe from a pattern', (assert, done) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis
      .psubscribe('new?', function () {})
      .then(() => {
        return redis.punsubscribe('new?')
      })
      .then(() => {
        setTimeout(() => {
          assert.isUndefined(redis.psubscribers['new:user'])
          assert.deepEqual(redis.psubscribers, {})
          assert.equal(redis.subscriberConnection.listenerCount('message'), 0)
          assert.equal(redis.subscriberConnection.listenerCount('pmessage'), 0)
          return redis.quit()
        })
      }).then(() => {
        done()
      }).catch(done)
  })

  test('should throw error when subscriber handler is not defined', async (assert) => {
    assert.plan(1)
    const redis = new RedisFactory({port: 6379, host: 'localhost'})

    try {
      await redis.subscribe('bar', {})
    } catch ({ message }) {
      assert.equal(message, 'Redis.subscribe needs a callback function or ioc reference string')
    }
  })

  test('should throw error when pattern subscriber handler is not defined', async (assert) => {
    assert.plan(1)
    const redis = new RedisFactory({port: 6379, host: 'localhost'})

    try {
      await redis.psubscribe('new?', {})
    } catch ({ message }) {
      assert.equal(message, 'Redis.psubscribe needs a callback function or ioc reference string')
    }
  })

  test('should not listen to messages on different channels', (assert, done) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis.subscribe('bar', async (message, channel) => {
      assert.equal(channel, 'bar')
      await redis.quit()
      done()
    }).then(function () {
      redis.publish('foo', 'baz')
      redis.publish('bar', 'baz')
    })
  })

  // test('should be able to subscribe to multiple channels', (assert, done) => {
  //   const redis = new RedisFactory({port: 6379, host: 'localhost'}, Helpers)
  //   let x = 0
  //   redis.subscribe('foo', 'bar', async (message, channel) => {
  //     x++
  //     expect(channel).to.be.oneOf(['foo', 'bar'])
  //     if (x === 2) {
  //       redis.unsubscribe('foo', 'bar', function () {})
  //       await redis.quit()
  //       done()
  //     }
  //   }).done(function () {
  //     redis.publish('foo', 'baz')
  //     redis.publish('bar', 'baz')
  //   })
  // })

  test('should be able to pipe commands', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    const pipe = redis.pipeline()
    const currentTime = new Date().getTime()
    pipe.set('time', currentTime)
    pipe.get('time')
    const result = await pipe.exec()
    assert.equal(result[1][1], currentTime.toString())
    await redis.quit()
  })

  test('should not throw exception when unsubscribing from unknown channels', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    await redis.unsubscribe('bar')
    await redis.quit()
  })

  test('should not throw exception when unsubscribing from unknown channels', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    await redis.punsubscribe('new?')
    await redis.quit()
  })

  test('should be able to pipeline commands', async (assert) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    const results = await redis.pipeline().set('foo', 'bar').get('foo').exec()
    assert.deepEqual(results, [[null, 'OK'], [null, 'bar']])
    await redis.quit()
  })

  test('should close subscriber connection with normal connection when quit is called', (assert, done) => {
    const redis = new RedisFactory({port: 6379, host: 'localhost'})
    redis
    .subscribe('foo', async function () {})
    .then(() => redis.quit())
    .then((response) => {
      assert.deepEqual(response, ['OK', 'OK'])
      setTimeout(() => {
        assert.equal(redis.connection.status, 'end')
        assert.equal(redis.subscriberConnection.status, 'end')
        done()
      }, 200)
    }).catch(done)
  })
})
