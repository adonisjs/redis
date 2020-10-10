/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/redis.ts" />

import Redis from 'ioredis'
import { RedisClusterConfig } from '@ioc:Adonis/Addons/Redis'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

import { ioMethods } from '../ioMethods'
import { AbstractConnection } from '../AbstractConnection'

/**
 * Redis cluster connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing multiple
 * pub/sub connections by hand, since it handles that internally by itself.
 */
export class RedisClusterConnection extends AbstractConnection<Redis.Cluster> {
	constructor(
		connectionName: string,
		private config: RedisClusterConfig,
		application: ApplicationContract
	) {
		super(connectionName, application)
		this.ioConnection = new Redis.Cluster(this.config.clusters as any[], this.config.clusterOptions)
		this.proxyConnectionEvents()
	}

	/**
	 * Creates the subscriber connection, the [[AbstractConnection]] will
	 * invoke this method when first subscription is created.
	 */
	protected makeSubscriberConnection() {
		this.ioSubscriberConnection = new Redis.Cluster(
			this.config.clusters as [],
			this.config.clusterOptions
		)
	}

	/**
	 * Returns cluster nodes
	 */
	public nodes(role?: Redis.NodeRole) {
		return this.ioConnection.nodes(role)
	}
}

ioMethods.forEach((method) => {
	RedisClusterConnection.prototype[method] = function redisConnectionProxyFn(...args: any[]) {
		return this.ioConnection[method](...args)
	}
})
