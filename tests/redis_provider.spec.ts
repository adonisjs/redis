/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'

import { defineConfig } from '../index.js'
import { pEvent } from '../tests_helpers/main.js'
import RedisManager from '../src/redis_manager.js'

const BASE_URL = new URL('./tmp/', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, BASE_URL).href)
  }
  return import(filePath)
}

test.group('Redis Provider', () => {
  test('register redis provider', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: ['../../providers/redis_provider.js'],
        },
      })
      .withCoreConfig()
      .withCoreProviders()
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    assert.instanceOf(await app.container.make('redis'), RedisManager)
  })

  test('define repl bindings', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreConfig()
      .merge({
        rcFileContents: {
          providers: ['../../providers/redis_provider.js'],
        },
      })
      .withCoreProviders()
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('repl')
    await app.init()
    await app.boot()

    const repl = await app.container.make('repl')
    assert.property(repl.getMethods(), 'loadRedis')
    assert.isFunction(repl.getMethods().loadRedis.handler)
  })

  test('disconnect all connections on app termination', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: ['../../providers/redis_provider.js'],
        },
      })
      .withCoreConfig()
      .withCoreProviders()
      .merge({
        config: {
          redis: defineConfig({
            connection: 'primary',
            connections: {
              primary: {
                host: process.env.REDIS_HOST,
                port: Number(process.env.REDIS_PORT),
              },
            },
          }),
        },
      })
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    const redis = await app.container.make('redis')
    assert.isNull(await redis.connection().get('username'))
    assert.equal(redis.activeConnectionsCount, 1)

    await Promise.all([pEvent(redis.connection(), 'end'), app.terminate()])
    assert.equal(redis.activeConnectionsCount, 0)
  })
})
