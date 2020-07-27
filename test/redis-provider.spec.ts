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
import { Registrar, Ioc } from '@adonisjs/fold'
import { Config } from '@adonisjs/config/build/standalone'
import { Emitter } from '@adonisjs/events/build/standalone'
import { RedisManager } from '../src/RedisManager'

test.group('Redis Provider', () => {
	test('register redis provider', async (assert) => {
		const ioc = new Ioc()
		ioc.bind('Adonis/Core/Config', () => {
			return new Config({
				redis: {
					connection: 'local',
					connections: {
						local: {},
					},
				},
			})
		})

		ioc.bind('Adonis/Core/Event', () => {
			return new Emitter(ioc)
		})

		const registrar = new Registrar(ioc, join(__dirname, '..'))
		await registrar.useProviders(['./providers/RedisProvider']).registerAndBoot()

		assert.instanceOf(ioc.use('Adonis/Addons/Redis'), RedisManager)
		assert.deepEqual(ioc.use('Adonis/Addons/Redis'), ioc.use('Adonis/Addons/Redis'))
	})

	test('raise error when config is missing', async (assert) => {
		const ioc = new Ioc()
		ioc.bind('Adonis/Core/Config', () => {
			return new Config({})
		})

		ioc.bind('Adonis/Core/Event', () => {
			return new Emitter(ioc)
		})

		const registrar = new Registrar(ioc, join(__dirname, '..'))
		await registrar.useProviders(['./providers/RedisProvider']).registerAndBoot()

		const fn = () => ioc.use('Adonis/Addons/Redis')
		assert.throw(
			fn,
			'Invalid "redis" config. Missing value for "connection". Make sure set it inside "config/redis"'
		)
	})

	test('raise error when primary connection is not defined', async (assert) => {
		const ioc = new Ioc()
		ioc.bind('Adonis/Core/Config', () => {
			return new Config({})
		})

		ioc.bind('Adonis/Core/Event', () => {
			return new Emitter(ioc)
		})

		const registrar = new Registrar(ioc, join(__dirname, '..'))
		await registrar.useProviders(['./providers/RedisProvider']).registerAndBoot()

		const fn = () => ioc.use('Adonis/Addons/Redis')
		assert.throw(
			fn,
			'Invalid "redis" config. Missing value for "connection". Make sure set it inside "config/redis"'
		)
	})

	test('raise error when connections are not defined', async (assert) => {
		const ioc = new Ioc()
		ioc.bind('Adonis/Core/Config', () => {
			return new Config({
				redis: {
					connection: 'local',
				},
			})
		})

		ioc.bind('Adonis/Core/Event', () => {
			return new Emitter(ioc)
		})

		const registrar = new Registrar(ioc, join(__dirname, '..'))
		await registrar.useProviders(['./providers/RedisProvider']).registerAndBoot()

		const fn = () => ioc.use('Adonis/Addons/Redis')
		assert.throw(
			fn,
			'Invalid "redis" config. Missing value for "connections". Make sure set it inside "config/redis"'
		)
	})

	test('raise error when primary connection is not defined in the connections list', async (assert) => {
		const ioc = new Ioc()
		ioc.bind('Adonis/Core/Config', () => {
			return new Config({
				redis: {
					connection: 'local',
					connections: {},
				},
			})
		})

		ioc.bind('Adonis/Core/Event', () => {
			return new Emitter(ioc)
		})

		const registrar = new Registrar(ioc, join(__dirname, '..'))
		await registrar.useProviders(['./providers/RedisProvider']).registerAndBoot()

		const fn = () => ioc.use('Adonis/Addons/Redis')
		assert.throw(
			fn,
			'Invalid "redis" config. "local" is not defined inside "connections". Make sure set it inside "config/redis"'
		)
	})
})
