/*
 * @adonisjs/events
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { join } from 'path'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import { RedisManager } from '../src/RedisManager'

const fs = new Filesystem(join(__dirname, 'app'))

async function setup(environment: 'web' | 'repl', redisConfig: any) {
  await fs.add('.env', '')
  await fs.add(
    'config/app.ts',
    `
		export const appKey = 'averylong32charsrandomsecretkey',
		export const http = {
			cookie: {},
			trustProxy: () => true,
		}
	`
  )

  await fs.add(
    'config/redis.ts',
    `
		const redisConfig = ${JSON.stringify(redisConfig, null, 2)}
		export default redisConfig
	`
  )

  const app = new Application(fs.basePath, environment, {
    providers: ['@adonisjs/core', '@adonisjs/repl', '../../providers/RedisProvider'],
  })

  await app.setup()
  await app.registerProviders()
  await app.bootProviders()

  return app
}

test.group('Redis Provider', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('register redis provider', async (assert) => {
    const app = await setup('web', {
      connection: 'local',
      connections: {
        local: {},
      },
    })

    assert.instanceOf(app.container.use('Adonis/Addons/Redis'), RedisManager)
    assert.deepEqual(app.container.use('Adonis/Addons/Redis')['application'], app)
    assert.deepEqual(
      app.container.use('Adonis/Addons/Redis'),
      app.container.use('Adonis/Addons/Redis')
    )
  })

  test('raise error when config is missing', async (assert) => {
    assert.plan(1)

    try {
      await setup('web', {})
    } catch (error) {
      assert.equal(
        error.message,
        'Invalid "redis" config. Missing value for "connection". Make sure to set it inside the "config/redis" file'
      )
    }
  })

  test('raise error when primary connection is not defined', async (assert) => {
    assert.plan(1)

    try {
      await setup('web', {})
    } catch (error) {
      assert.equal(
        error.message,
        'Invalid "redis" config. Missing value for "connection". Make sure to set it inside the "config/redis" file'
      )
    }
  })

  test('raise error when connections are not defined', async (assert) => {
    assert.plan(1)

    try {
      await setup('web', {
        connection: 'local',
      })
    } catch (error) {
      assert.equal(
        error.message,
        'Invalid "redis" config. Missing value for "connections". Make sure to set it inside the "config/redis" file'
      )
    }
  })

  test('raise error when primary connection is not defined in the connections list', async (assert) => {
    assert.plan(1)

    try {
      await setup('web', {
        connection: 'local',
        connections: {},
      })
    } catch (error) {
      assert.equal(
        error.message,
        'Invalid "redis" config. "local" is not defined inside "connections". Make sure to set it inside the "config/redis" file'
      )
    }
  })

  test('define repl bindings', async (assert) => {
    const app = await setup('repl', {
      connection: 'local',
      connections: {
        local: {},
      },
    })

    assert.property(app.container.use('Adonis/Addons/Repl')['customMethods'], 'loadRedis')
    assert.isFunction(app.container.use('Adonis/Addons/Repl')['customMethods']['loadRedis'].handler)
  })

  test('define health checks', async (assert) => {
    const app = await setup('web', {
      connection: 'local',
      connections: {
        local: {
          healthCheck: true,
        },
      },
    })

    assert.property(app.container.use('Adonis/Core/HealthCheck')['healthCheckers'], 'redis')
    assert.equal(
      app.container.use('Adonis/Core/HealthCheck')['healthCheckers'].redis,
      'Adonis/Addons/Redis'
    )
  })
})
