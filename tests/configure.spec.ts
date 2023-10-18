/*
 * @adonisjs/mail
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'
import { IgnitorFactory } from '@adonisjs/core/factories'
import Configure from '@adonisjs/core/commands/configure'

export const BASE_URL = new URL('./tmp/', import.meta.url)

async function setupConfigureCommand() {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .create(BASE_URL, {
      importer: (filePath) => {
        if (filePath.startsWith('./') || filePath.startsWith('../')) {
          return import(new URL(filePath, BASE_URL).href)
        }

        return import(filePath)
      },
    })

  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()

  const ace = await app.container.make('ace')
  const command = await ace.create(Configure, ['../../index.js'])

  command.ui.switchMode('raw')

  return { command }
}

test.group('Configure', (group) => {
  group.each.setup(({ context }) => {
    context.fs.baseUrl = BASE_URL
    context.fs.basePath = fileURLToPath(BASE_URL)
  })

  test('publish config file', async ({ assert }) => {
    const { command } = await setupConfigureCommand()

    await command.exec()

    await assert.fileExists('config/redis.ts')
    await assert.fileContains('config/redis.ts', 'const redisConfig = defineConfig({')
    await assert.fileContains('config/redis.ts', 'export default redisConfig')
    await assert.fileContains('config/redis.ts', `declare module '@adonisjs/redis/types'`)
  })

  test('add redis_provider to the rc file', async ({ fs, assert }) => {
    await fs.createJson('tsconfig.json', {})
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const { command } = await setupConfigureCommand()
    await command.exec()

    await assert.fileExists('adonisrc.ts')
    await assert.fileContains(
      'adonisrc.ts',
      `providers: [() => import('@adonisjs/redis/redis_provider')]`
    )
  })

  test('add env variables for the selected drivers', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', {})
    await fs.create('.env', '')
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const { command } = await setupConfigureCommand()
    await command.exec()

    await assert.fileContains('.env', 'REDIS_HOST=127.0.0.1')
    await assert.fileContains('.env', 'REDIS_PORT=6379')
    await assert.fileContains('.env', 'REDIS_PASSWORD=')

    await assert.fileContains('start/env.ts', `REDIS_HOST: Env.schema.string({ format: 'host' })`)
    await assert.fileContains('start/env.ts', 'REDIS_PORT: Env.schema.number()')
  })
})
