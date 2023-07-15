/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { IgnitorFactory } from '@adonisjs/core/factories'
import { test } from '@japa/runner'

const BASE_URL = new URL('./tmp/', import.meta.url)

test.group('Redis Provider', () => {
  test('register redis provider', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: ['./providers/redis_provider.js'],
        },
      })
      .withCoreConfig()
      .create(BASE_URL, {
        importer: (filePath) => import(new URL(filePath, new URL('../', import.meta.url)).href),
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    assert.isTrue(app.container.hasBinding('redis'))
  })

  test('define repl bindings', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreConfig()
      .merge({
        rcFileContents: {
          providers: ['../providers/redis_provider.js'],
        },
      })
      .withCoreProviders()
      .create(BASE_URL, {
        importer: (filePath) => import(filePath),
      })

    const app = ignitor.createApp('repl')
    await app.init()
    await app.boot()

    const repl = await app.container.make('repl')
    assert.property(repl.getMethods(), 'loadRedis')
    assert.isFunction(repl.getMethods().loadRedis.handler)
  })
})
