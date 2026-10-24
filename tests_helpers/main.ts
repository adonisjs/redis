/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { once } from 'node:events'
import type Emittery from 'emittery'
import { createServer, type AddressInfo, type Socket } from 'node:net'

/**
 * Promisify an event
 */
export function pEvent<T, K extends keyof T>(
  emitter: Emittery<T>,
  event: K,
  timeout: number = 500
) {
  return new Promise<T[K] | null>((resolve) => {
    function handler(data: T[K]) {
      emitter.off(event, handler)
      resolve(data)
    }

    setTimeout(() => {
      emitter.off(event, handler)
      resolve(null)
    }, timeout)
    emitter.on(event, handler)
  })
}

/**
 * Starts a fake Redis server that answers "+OK" to every command until
 * `silence` is called, then keeps connections open without answering,
 * like a half-open TCP connection.
 */
export async function createSilentServer() {
  let silent = false
  const sockets = new Set<Socket>()

  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('data', (chunk) => {
      if (!silent) {
        const commands = chunk.toString().match(/^\*/gm)?.length ?? 0
        socket.write('+OK\r\n'.repeat(commands))
      }
    })
  }).listen(0, '127.0.0.1')
  await once(server, 'listening')

  return {
    port: (server.address() as AddressInfo).port,
    silence() {
      silent = true
    },
    close() {
      sockets.forEach((socket) => socket.destroy())
      server.close()
    },
  }
}
