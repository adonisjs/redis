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

async function setup(redisConfig: any) {
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

	const app = new Application(fs.basePath, 'web', {
		providers: ['@adonisjs/core', '../../providers/RedisProvider'],
	})

	app.setup()
	app.registerProviders()
	await app.bootProviders()

	return app
}

test.group('Redis Provider', (group) => {
	group.afterEach(async () => {
		await fs.cleanup()
	})

	test('register redis provider', async (assert) => {
		const app = await setup({
			connection: 'local',
			connections: {
				local: {},
			},
		})

		assert.instanceOf(app.container.use('Adonis/Addons/Redis'), RedisManager)
		assert.deepEqual(
			app.container.use('Adonis/Addons/Redis'),
			app.container.use('Adonis/Addons/Redis')
		)
	})

	test('raise error when config is missing', async (assert) => {
		assert.plan(1)

		try {
			await setup({})
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
			await setup({})
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
			await setup({
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
			await setup({
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
})
