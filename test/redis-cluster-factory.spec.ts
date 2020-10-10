/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../adonis-typings/redis.ts" />

import test from 'japa'
import { Application } from '@adonisjs/core/build/standalone'
import { RedisClusterConnectionContract } from '@ioc:Adonis/Addons/Redis'

import { RedisClusterConnection } from '../src/RedisClusterConnection'

const nodes = process.env.REDIS_CLUSTER_PORTS!.split(',').map((port) => {
	return { host: process.env.REDIS_HOST!, port: Number(port) }
})

test.group('Redis cluster factory', () => {
	test('emit ready when connected to redis server', (assert, done) => {
		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: nodes,
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('ready', async () => {
			assert.isTrue(true)
			await factory.quit()
			done()
		})
	})

	test('emit node connection event', (assert, done) => {
		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: [{ host: process.env.REDIS_HOST!!, port: 7000 }],
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('node:added', async () => {
			assert.isTrue(true)
			await factory.quit()
			done()
		})
	})

	test('execute redis commands', async (assert) => {
		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: nodes,
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		await factory.set('greeting', 'hello world')
		const greeting = await factory.get('greeting')
		assert.equal(greeting, 'hello world')

		await factory.del('greeting')
		await factory.quit()
	})

	test('clean event listeners on quit', async (assert, done) => {
		assert.plan(2)

		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: nodes,
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('end', () => {
			assert.equal(factory.ioConnection.listenerCount('ready'), 0)
			assert.equal(factory.ioConnection.listenerCount('end'), 0)
			done()
		})

		factory.on('ready', async () => {
			await factory.quit()
		})
	})

	test('clean event listeners on disconnect', async (assert, done) => {
		assert.plan(2)

		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: nodes,
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('end', () => {
			assert.equal(factory.ioConnection.listenerCount('ready'), 0)
			assert.equal(factory.ioConnection.listenerCount('end'), 0)
			done()
		})

		factory.on('ready', async () => {
			await factory.disconnect()
		})
	})

	test('get event for connection errors', async (assert, done) => {
		assert.plan(2)

		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: [{ host: process.env.REDIS_HOST!, port: 5000 }],
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('end', () => {
			assert.equal(factory.ioConnection.listenerCount('ready'), 0)
			assert.equal(factory.ioConnection.listenerCount('end'), 0)
			done()
		})

		factory.on('error', () => {})

		/**
		 * `error` event is also emitted
		 */
		factory.on('node:error', async () => {
			await factory.quit()
		})
	})

	test('access cluster nodes', async (assert, done) => {
		assert.plan(3)

		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: nodes,
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('end', () => {
			assert.equal(factory.ioConnection.listenerCount('ready'), 0)
			assert.equal(factory.ioConnection.listenerCount('end'), 0)
			done()
		})

		factory.on('ready', async () => {
			assert.isAbove(factory.nodes().length, 2) // defined in compose file
			await factory.quit()
		})
	})

	test('get report for connected connection', async (assert, done) => {
		assert.plan(5)

		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: nodes,
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('end', () => {
			assert.equal(factory.ioConnection.listenerCount('ready'), 0)
			assert.equal(factory.ioConnection.listenerCount('end'), 0)
			done()
		})

		factory.on('ready', async () => {
			const report = await factory.getReport(true)

			assert.equal(report.status, 'ready')
			assert.isNull(report.error)
			assert.isDefined(report.used_memory)

			await factory.quit()
		})
	})

	test('get report for errored connection', async (assert, done) => {
		assert.plan(5)

		const factory = (new RedisClusterConnection(
			'main',
			{
				clusters: [{ host: process.env.REDIS_HOST!, port: 5000 }],
			},
			new Application(__dirname, 'web', {})
		) as unknown) as RedisClusterConnectionContract

		factory.on('end', () => {
			assert.equal(factory.ioConnection.listenerCount('ready'), 0)
			assert.equal(factory.ioConnection.listenerCount('end'), 0)
			done()
		})

		factory.on('error', async () => {
			const report = await factory.getReport(true)
			assert.notEqual(report.status, 'ready')
			assert.match(report.error.message, /Failed to refresh/)
			assert.equal(report.used_memory, 'unknown')

			await factory.quit()
		})
	})
})
