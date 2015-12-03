'use strict'

/**
 * adonis-redis
 * Copyright(c) 2015-2015- Harminder Virk
 * MIT Licensed
 */

const RedisFactory = require('../src/Redis/factory')
const Redis = require('../src/Redis')
const chai = require('chai')
const expect = chai.expect
require('co-mocha')

const Env = {
  get: function () {
    return 'default'
  }
}

const Config = {
  get: function (key) {
    if(key === 'database.redis.cluster') {
      return false
    }
    return {port:6379, host:'localhost'}
  }
}


describe('Redis', function() {

  it('should setup connection with redis', function (done) {
    const redis = new Redis(Env, Config, RedisFactory)
    redis.redis.once('connect', function () {
      done()
    })
  })

  it('should use proxy to call command over redis client', function * () {
    const redis = new Redis(Env, Config, RedisFactory)
    redis.set('foo', 'bar')
    const foo = yield redis.get('foo')
    expect(foo).to.equal('bar')
  })

  it('should be able to pub/sub', function (done) {
    const redis = new Redis(Env, Config, RedisFactory)
    redis.subscribe('new:user', function * (message) {
      expect(message).to.equal('virk')
      done()
    }).done(function () {
      redis.publish('new:user', 'virk')
    })
  })

  it('should not listen to messages on different channels', function (done) {
    const redis = new Redis(Env, Config, RedisFactory)
    redis.subscribe('bar', function * (message, channel) {
      expect(channel).to.equal('bar')
      done()
    }).done(function () {
      redis.publish('foo')
      redis.publish('bar')
    })
  })

  it('should be able to pipe commands', function (done) {
    const redis = new Redis(Env, Config, RedisFactory)
    redis.pipeline(function * (pipe) {
      const currentTime = new Date().getTime()
      pipe.set('time', currentTime)
      pipe.get('time')
      const result = yield pipe.exec()
      expect(result[1][1]).to.equal(currentTime.toString())
      done()
    })
  })

  it('should remove subscriber when unable to set subscriber', function (done) {
    const Config = {
      get: function (key) {
        if(key === 'database.redis.cluster') {
          return false
        }
        return {port:2222, host:'localhost'}
      }
    }
    const redis = new Redis(Env, Config, RedisFactory)
    redis.subscribe('bar', function * (message, channel) {
      expect(channel).to.equal('bar')
    }).done(function (error) {
      expect(redis.subscribers['bar']).to.equal(undefined)
      done()
    })
  })

})
