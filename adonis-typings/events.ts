/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

declare module '@ioc:Adonis/Core/Event' {
	import { Redis } from 'ioredis'
	import { RedisClusterConnectionContract, RedisConnectionContract } from '@ioc:Adonis/Addons/Redis'

	interface EventsList {
		'redis:ready': { connection: RedisClusterConnectionContract | RedisConnectionContract }
		'redis:connect': { connection: RedisClusterConnectionContract | RedisConnectionContract }
		'redis:error': {
			error: any
			connection: RedisClusterConnectionContract | RedisConnectionContract
		}
		'redis:end': { connection: RedisClusterConnectionContract | RedisConnectionContract }

		'node:added': { connection: RedisClusterConnectionContract; node: Redis }
		'node:removed': { connection: RedisClusterConnectionContract; node: Redis }
		'node:error': { error: any; connection: RedisClusterConnectionContract; address: string }
	}
}
