/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ApplicationService } from '@adonisjs/core/types'
import { defineReplBindings } from '../src/repl_bindings.js'

/**
 * Provider to bind redis to the container
 */
export default class RedisProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Define repl bindings
   */
  async #defineReplBindings() {
    if (this.app.getEnvironment() !== 'repl') {
      return
    }

    defineReplBindings(this.app, await this.app.container.make('repl'))
  }

  /**
   * Register the redis binding
   */
  register() {
    this.app.container.singleton('redis', async () => {
      const { default: RedisManager } = await import('../src/redis_manager.js')

      const emitter = await this.app.container.make('emitter')
      const config = this.app.config.get<any>('redis', {})

      return new RedisManager(this.app, config, emitter)
    })
  }

  /**
   * Registering the health check checker with HealthCheck service
   */
  boot() {
    this.#defineReplBindings()
  }

  /**
   * Gracefully shutdown connections when app goes down
   */
  async shutdown() {
    const redis = await this.app.container.make('redis')
    await redis.quitAll()
  }
}
