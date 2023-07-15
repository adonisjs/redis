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
    // @ts-ignore
    assert.throws(defineConfig, 'Invalid config. It must be a valid object')
  })

  test('should throw if no connections', ({ assert }) => {
    assert.throws(
      // @ts-ignore
      () => defineConfig({ connection: 'hey' }),
      'Invalid config. Missing property "connections" inside it'
    )
  })

  test('should throw if connection is not defined inside connections', ({ assert }) => {
    assert.throws(
      () =>
        defineConfig({
          // @ts-ignore
          connection: 'hey',
          connections: {},
        }),
      'Invalid config. Missing property "connection" or the connection name is not defined inside "connections" object'
    )
  })
})
