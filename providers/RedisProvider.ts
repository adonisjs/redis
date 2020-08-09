/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { IocContract } from '@adonisjs/fold'
import { RedisManagerContract } from '@ioc:Adonis/Addons/Redis'

/**
 * Provider to bind redis to the container
 */
export default class RedisProvider {
	constructor(protected container: IocContract) {}

	/**
	 * Register the redis binding
	 */
	public register() {
		this.container.singleton('Adonis/Addons/Redis', () => {
			const config = this.container.use('Adonis/Core/Config').get('redis', {})
			const emitter = this.container.use('Adonis/Core/Event')
			const { RedisManager } = require('../src/RedisManager')

			return new RedisManager(this.container, config, emitter)
		})
	}

	/**
	 * Registering the health check checker with HealthCheck service
	 */
	public boot() {
		this.container.with(
			['Adonis/Core/HealthCheck', 'Adonis/Addons/Redis'],
			(HealthCheck, Redis: RedisManagerContract) => {
				if (Redis.healthChecksEnabled) {
					HealthCheck.addChecker('redis', 'Adonis/Addons/Redis')
				}
			}
		)
	}

	/**
	 * Gracefully shutdown connections when app goes down
	 */
	public async shutdown() {
		const Redis: RedisManagerContract = this.container.use('Adonis/Addons/Redis')
		await Redis.quitAll()
	}
}
