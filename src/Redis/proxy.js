'use strict'

/**
 * adonis-redis
 * Copyright(c) 2015-2015 Harminder Virk
 * MIT Licensed
 */

let proxy = exports = module.exports = {}

/**
 * key to get values for from target object
 * @type {Array}
 */
const onTarget = [
  'redis',
  'publisher',
  'subscribe',
  'publish',
  'subscribers',
  'config',
  'pipeline',
  'newConnection',
  '_handleMessage',
  'activeChannel',
  'done',
  '_getSubscriber',
  '_setSubscriber',
  '_removeSubscriber'
]

/**
 * @description proxies the target attributes and returns defined implementation
 * for them
 * @method get
 * @param  {Object} target
 * @param  {String} name
 * @return {Mixed}
 * @public
 */
proxy.get = function (target,name) {
  if(onTarget.indexOf(name) > -1) {
    return target[name]
  }
  return target.redis[name]
}
