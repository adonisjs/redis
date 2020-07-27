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
import { RedisManager } from '../src/RedisManager'

test.group('Redis Provider', () => {
	test('register redis provider', async (assert) => {
		const ioc = new Ioc()
		ioc.bind('Adonis/Core/Config', () => {
			return new Config({})
		})

		const registrar = new Registrar(ioc, join(__dirname, '..'))
		await registrar.useProviders(['./providers/RedisProvider']).registerAndBoot()

		assert.instanceOf(ioc.use('Adonis/Addons/Redis'), RedisManager)
		assert.deepEqual(ioc.use('Adonis/Addons/Redis'), ioc.use('Adonis/Core/Redis'))
	})
})
