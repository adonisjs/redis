'use strict'

/*
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const GE = require('@adonisjs/generic-exceptions')
const _ = require('lodash')
const proxyHandler = require('./proxyHandler')

/**
 * Redis class is used to call methods on a redis server.
 * This library creates a pool of connections and reuse
 * them.
 *
 * @namespace Adonis/Addons/Redis
 * @singleton
 * @alias Redis
 *
 * @class Redis
 * @constructor
 */
class Redis {
  constructor (Config, Factory) {
    this.Config = Config
    this.Factory = Factory
    this.connectionPools = {}
    return new Proxy(this, proxyHandler)
  }

  /**
   * Looks at the config file and tells if a
   * cluster connection to be created or
   * not
   *
   * @param   {Object}  config
   *
   * @return  {Boolean}
   *
   * @private
   */
  _isCluster (config) {
    return !!config.clusters
  }

  /**
   * Closes a given redis connection by quitting
   * and removing it from the connectionsPool.
   *
   * @param   {String} connection
   *
   * @private
   */
  _closeConnection (connection) {
    const redisConnection = this.connectionPools[connection]
    if (!redisConnection) {
      return
    }
    _.unset(this.connectionPools, connection)
    return redisConnection.quit()
  }

  /**
   * Returns instance of a new factory instance for
   * a given connection.
   *
   * @param  {String} [connection='']
   *
   * @return {RedisFactory}
   */
  connection (connection = '') {
    connection = connection || this.Config.get('redis.connection')
    const config = this.Config.get(`redis.${connection}`)

    return this.namedConnection(connection, config)
  }

  /**
   * Creates a connection using raw config and adds it to the
   * connection pool.
   *
   * @method namedConnection
   *
   * @param  {String}        name
   * @param  {Object}        config
   *
   * @return {RedisFactory}
   */
  namedConnection (name, config) {
    if (this.connectionPools[name]) {
      return this.connectionPools[name]
    }

    if (!config || !_.size(config) === 0) {
      throw GE.RuntimeException.missingConfig(name || 'configuration for redis', 'config/redis.js')
    }

    this.connectionPools[name] = new this.Factory(config, this._isCluster(config))
    return this.connectionPools[name]
  }

  /**
   * Returns a hash of connection pools
   *
   * @return {Object}
   *
   * @public
   */
  getConnections () {
    return this.connectionPools
  }

  /**
   * Closes a single or number of redis connections
   *
   * @param  {Spread} connections
   *
   * @public
   */
  quit (...name) {
    const connections = _.isArray(name) ? name : [name]
    return Promise.all(_.map(connections, (connection) => this._closeConnection(connection)))
  }
}

module.exports = Redis
