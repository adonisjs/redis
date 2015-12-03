'use strict'

/**
 * adonis-redis
 * Copyright(c) 2015-2015- Harminder Virk
 * MIT Licensed
 */

class Redis {

  constructor (Env, Config, Factory) {
    const connection = Env.get('REDIS_CONNECTION')
    const config = Config.get('database.redis.' + connection)
    const useCluster = Config.get('database.redis.cluster', false)
    return new Factory(config, useCluster)
  }

}

module.exports = Redis
