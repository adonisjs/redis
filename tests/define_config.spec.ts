/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { defineConfig } from '../src/define_config.js'

test.group('Define Config', () => {
  test('should throw if no config passed', ({ assert }) => {
    // @ts-expect-error
    assert.throws(defineConfig, 'Invalid config. It must be an object')
  })

  test('should throw if no connections', ({ assert }) => {
    assert.throws(
      // @ts-expect-error
      () => defineConfig({ connection: 'hey' }),
      'Missing "connections" property in the redis config file'
    )
  })

  test('should throw if connection is not defined inside connections', ({ assert }) => {
    assert.throws(
      () =>
        defineConfig({
          // @ts-expect-error
          connection: 'hey',
          connections: {},
        }),
      'Missing "connections.hey". It is referenced by the "default" redis connection'
    )
  })

  test('should throw if default connection is not defined', ({ assert }) => {
    assert.throws(
      () =>
        // @ts-expect-error
        defineConfig({
          connections: {},
        }),
      'Missing "connection" property in redis config. Specify a default connection to use'
    )
  })
})
