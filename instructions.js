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

module.exports = async function (cli) {
  try {
    await cli.copy(
      path.join(__dirname, './examples/redis.js'),
      path.join(cli.helpers.configPath(), 'redis.js')
    )
    cli.command.completed('create', 'config/redis.js')
  } catch (error) {
    // ignore error when redis.js already exists
  }
}
