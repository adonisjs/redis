/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationService } from '@adonisjs/core/types'
import type { RedisService } from '../src/types/main.js'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    redis: RedisService
  }
}

/**
 * Registering the Redis manager as a singleton to the container
 * and defining REPL bindings
 */
export default class RedisProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Define repl bindings
   */
  protected async defineReplBindings() {
    if (this.app.getEnvironment() !== 'repl') {
      return
    }

    const { defineReplBindings } = await import('../src/repl_bindings.js')
    defineReplBindings(this.app, await this.app.container.make('repl'))
  }

  /**
   * Register the Redis manager as a singleton with the
   * container
   */
  register() {
    this.app.container.singleton('redis', async () => {
      const { default: RedisManager } = await import('../src/redis_manager.js')

      const config = this.app.config.get<any>('redis', {})
      const logger = await this.app.container.make('logger')
      return new RedisManager(config, logger)
    })
  }

  /**
   * Defining repl bindings on boot
   */
  async boot() {
    await this.defineReplBindings()
  }

  /**
   * Gracefully shutdown connections when app goes down
   */
  async shutdown() {
    const redis = await this.app.container.make('redis')
    await redis.quitAll()
  }
}
