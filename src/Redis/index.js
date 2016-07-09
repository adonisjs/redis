'use strict'

/**
 * adonis-redis
 * Copyright(c) 2015-2015- Harminder Virk
 * MIT Licensed
 */

require('harmony-reflect')
const NE = require('node-exceptions')
const CatLog = require('cat-log')
const _ = require('lodash')
const logger = new CatLog('adonis:redis')
const proxyHandler = require('./proxyHandler')

class Redis {

  constructor (Config, Factory) {
    this.Factory = Factory
    this.Config = Config
    this.connectionPools = {}
    return new Proxy(this, proxyHandler)
  }

  /**
   * returns configuration for a given connection
   * from config/redis.js file.
   *
   * @param   {String} connection
   *
   * @return  {Object}
   *
   * @throws {RuntimeException} If default connection is not found.
   *
   * @private
   */
  _getConfig (connection) {
    if (connection === 'default') {
      connection = this.Config.get('redis.connection')
      if (!connection) {
        throw new NE.RuntimeException('Make sure to define a default connection for redis')
      }
    }
    logger.verbose('getting config for %s connection', connection)
    return this.Config.get(`redis.${connection}`)
  }

  /**
   * returns redis factory instance for a given connection
   *
   * @param   {String} connection
   *
   * @return  {Object}
   *
   * @private
   */
  _getConnection (connection) {
    if (!this.connectionPools[connection]) {
      const config = this._getConfig(connection)
      if (!config) {
        throw new NE.RuntimeException(`Cannot get redis configuration for ${connection} connection`)
      }
      this.connectionPools[connection] = new this.Factory(config, this._isUsingCluster(config))
    }
    return this.connectionPools[connection]
  }

  /**
   * tells whether a user intends to use cluster
   *
   * @param   {Object}  config
   *
   * @return  {Boolean}
   *
   * @private
   */
  _isUsingCluster (config) {
    return !!config.clusters
  }

  /**
   * returns instance of a new factory instance for
   * a given connection
   *
   * @param  {String} connection
   *
   * @return {Object}            Instance of redis factory
   *
   * @public
   */
  connection (connection) {
    return this._getConnection(connection)
  }

  /**
   * returns all connections pools
   *
   * @return {Object}
   *
   * @public
   */
  getConnections () {
    return this.connectionPools
  }

  /**
   * closes a single or number of redis connections
   *
   * @param  {Spread} connections
   *
   * @public
   */
  quit () {
    const connections = _.size(arguments) ? _.toArray(arguments) : _.keys(this.getConnections())
    return Promise.all(_.map(connections, (connection) => {
      return this._closeConnection(connection)
    }))
  }

  /**
   * closes a given redis connection by quitting
   * and removing it from the connectionsPool.
   *
   * @param   {String} connection
   *
   * @private
   */
  _closeConnection (connection) {
    const redisConnection = this.connectionPools[connection] || null
    if (!redisConnection) {
      logger.warn('trying to close a non-existing redis connection named %s', connection)
      return
    }
    _.unset(this.connectionPools, connection)
    return redisConnection.quit()
  }

}

module.exports = Redis
