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
 * Defune repl bindings. The method must be invoked when application environment
 * is set to repl.
 */
export default function defineReplBindings(application: ApplicationContract) {
	const Repl = application.container.use('Adonis/Addons/Repl')

	Repl.addMethod(
		'loadRedis',
		(repl) => {
			repl.server.context.Redis = application.container.use('Adonis/Addons/Redis')
			repl.notify(
				`Loaded Redis module. You can access it using the "${repl.colors.underline(
					'Redis'
				)}" variable`
			)
		},
		{
			description: 'Load redis provider and save reference to the "Redis" variable',
		}
	)
}
