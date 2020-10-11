/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ApplicationContract } from '@ioc:Adonis/Core/Application'

/**
 * Provider to bind redis to the container
 */
export default class RedisProvider {
	constructor(protected app: ApplicationContract) {}
	public static needsApplication = true

	/**
	 * Register redis health check
	 */
	protected registerHealthCheck() {
		/**
		 * Do not register healthcheck when not running in web
		 * or test mode
		 */
		if (!['web', 'test'].includes(this.app.environment)) {
			return
		}

		this.app.container.with(
			['Adonis/Core/HealthCheck', 'Adonis/Addons/Redis'],
			(HealthCheck, Redis) => {
				if (Redis.healthChecksEnabled) {
					HealthCheck.addChecker('redis', 'Adonis/Addons/Redis')
				}
			}
		)
	}

	/**
	 * Define repl bindings
	 */
	protected defineReplBindings() {
		/**
		 * Do not register repl bindings when not running in "repl"
		 * environment
		 */
		if (this.app.environment !== 'repl') {
			return
		}

		require('../src/Bindings/Repl')(this.app)
	}

	/**
	 * Register the redis binding
	 */
	public register() {
		this.app.container.singleton('Adonis/Addons/Redis', () => {
			const config = this.app.container.use('Adonis/Core/Config').get('redis', {})
			const emitter = this.app.container.use('Adonis/Core/Event')
			const { RedisManager } = require('../src/RedisManager')

			return new RedisManager(this.app.container, config, emitter)
		})
	}

	/**
	 * Registering the health check checker with HealthCheck service
	 */
	public boot() {
		this.registerHealthCheck()
		this.defineReplBindings()
	}

	/**
	 * Gracefully shutdown connections when app goes down
	 */
	public async shutdown() {
		const Redis = this.app.container.use('Adonis/Addons/Redis')
		await Redis.quitAll()
	}
}
