/*
 * @adonisjs/redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join } from 'path'
import sinkStatic from '@adonisjs/sink'
import { ApplicationContract } from '@poppinss/application'

/**
 * A map to easily lookup the template to use for
 * cluster vs non-cluster config
 */
const templatesMap = {
  default: {
    config: join(__dirname, 'config/redis.txt'),
    contract: join(__dirname, 'contracts/redis.txt'),
  },
  cluster: {
    config: join(__dirname, 'config/redis-with-cluster.txt'),
    contract: join(__dirname, 'contracts/redis-with-cluster.txt'),
  },
}

/**
 * Key/value pair to be set inside the `.env` file
 */
const envValuesMap = {
  default: {
    REDIS_CONNECTION: 'default',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: '',
  },
  cluster: {
    REDIS_CONNECTION: 'default',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: '',
    REDIS_CLUSTER_HOST_1: '127.0.0.1',
    REDIS_CLUSTER_PORT_1: '6379',
    REDIS_CLUSTER_PASSWORD_1: '',
    REDIS_CLUSTER_HOST_2: '127.0.0.1',
    REDIS_CLUSTER_PORT_2: '6380',
    REDIS_CLUSTER_PASSWORD_2: '',
  },
}

/**
 * Copying config and contracts template to the app.
 */
export default async function instructions (
  projectRoot: string,
  application: ApplicationContract,
  { TemplateFile, kleur, getPrompt, EnvFile }: typeof sinkStatic,
) {
  const configFile = `${application.directoriesMap.get('config')}/redis.ts`
  const contractsFile = `${application.directoriesMap.get('contracts')}/redis.ts`

  /**
   * Asking user if they want to use cluster with redis or not
   */
  const useCluster = await getPrompt()
    .toggle('Should I create config for redis cluster', ['Yes, please do', 'No, I am good'])

  const templates = useCluster ? templatesMap.cluster : templatesMap.default
  const envValues = useCluster ? envValuesMap.cluster : envValuesMap.default

  /**
   * Creating config file
   */
  new TemplateFile(projectRoot, configFile, templates.config).apply({}).commit()
  console.log(`  create  ${kleur.green(configFile)}`)

  /**
   * Creating contracts file
   */
  new TemplateFile(projectRoot, contractsFile, templates.contract).apply({}).commit()
  console.log(`  create  ${kleur.green(contractsFile)}`)

  /**
   * Updating .env file with redis related env values
   */
  const env = new EnvFile('.env')
  Object.keys(envValues).forEach((key) => env.set(key, envValues[key]))
  env.commit()

  console.log(`  update  ${kleur.green('.env')}`)
}
