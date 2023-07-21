/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type Configure from '@adonisjs/core/commands/configure'

/**
 * Configures the package
 */
export async function configure(command: Configure) {
  /**
   * Publish config file
   */
  await command.publishStub('config/redis.stub')

  /**
   * Publish typings file
   */
  await command.publishStub('types/redis.stub')

  /**
   * Add environment variables
   */
  await command.defineEnvVariables({
    REDIS_CONNECTION: 'local',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: '',
  })

  /**
   * Add provider to rc file
   */
  await command.updateRcFile((rcFile) => {
    rcFile.addProvider('@adonisjs/redis/redis_provider')
  })
}
