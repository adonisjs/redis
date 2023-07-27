/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Redis } from 'ioredis'
import { pubSubMethods } from './pubsub_methods.js'

/**
 * Returns all method names for a given class
 */
function getAllMethodNames(obj: any) {
  let methods = new Set()
  while ((obj = Reflect.getPrototypeOf(obj))) {
    let keys = Reflect.ownKeys(obj)
    keys.forEach((k) => methods.add(k))
  }
  return [...methods] as string[]
}

const ignoredMethods = [
  'constructor',
  'status',
  'connect',
  'disconnect',
  'duplicate',
  'quit',
  '__defineGetter__',
  '__defineSetter__',
  'hasOwnProperty',
  '__lookupGetter__',
  '__lookupSetter__',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'valueOf',
  '__proto__',
  'defineCommand',
  'toLocaleString',
].concat(pubSubMethods)

/**
 * List of methods on Redis class
 */
export const ioMethods = getAllMethodNames(Redis.prototype).filter(
  (method) => !ignoredMethods.includes(method)
) as string[]
