'use strict'

/*
 * adonis-redis
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const path = require('path')

async function createConfigFile (cli) {
  try {
    await cli.copy(path.join(__dirname, 'examples/redis.js'), path.join(cli.helpers.configPath(), 'redis.js'))
    cli.command.completed('create', 'config/redis.js')
  } catch (e) {}
}

async function createListenerFile (cli) {
  try {
    await cli.copy(path.join(__dirname, 'examples/listener.js'), path.join(cli.helpers.appRoot(), 'start/redis.js'))
    cli.command.completed('create', 'start/redis.js')
  } catch (e) {}
}

module.exports = async function (cli) {
  createConfigFile(cli)
  createListenerFile(cli)
}
