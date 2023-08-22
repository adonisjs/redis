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

  const codemods = await command.createCodemods()

  /**
   * Add environment variables
   */
  await codemods.defineEnvVariables({
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: '',
  })

  /**
   * Validate environment variables
   */
  await codemods.defineEnvValidations({
    variables: {
      REDIS_HOST: `Env.schema.string({ format: 'host' })`,
      REDIS_PORT: 'Env.schema.number()',
    },
  })

  /**
   * Add provider to rc file
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@adonisjs/redis/redis_provider')
  })
}
