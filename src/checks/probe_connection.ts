/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Result } from '@adonisjs/core/health'
import type { Connection } from '../types.ts'

/**
 * Pings a connection, then runs `action`, for the health checks. It never
 * connects or reconnects the connection itself, and each run fails after
 * its own `timeout` (in milliseconds), which covers the wait for a
 * connecting connection, the ping and the action.
 *
 * ```
 * ready, connect  ──▶ ping ──▶ action
 * connecting      ──▶ wait for "ready" ──▶ ping ──▶ action
 *                         └── "close" / "end" ──▶ failed (lastError)
 * anything else   ──▶ failed at once (lastError)
 * timeout elapsed ──▶ failed
 * ```
 *
 * @example
 * ```ts
 * const result = await probeConnection(connection, 1_000, async () => Result.ok('Redis answered'))
 * ```
 */
export async function probeConnection(
  connection: Connection,
  timeout: number,
  action: () => Promise<Result>
): Promise<Result> {
  if (!connection.isReady() && connection.status !== 'connecting') {
    return Result.failed('Unable to connect to the redis server', connection.lastError)
  }

  const ioConnection = connection.ioConnection
  const statusEvents = ['ready', 'close', 'end']
  let onStatusChange: () => void = () => {}
  let timer: NodeJS.Timeout | undefined
  const timedOut = new Promise<Result>((resolve) => {
    timer = setTimeout(() => {
      resolve(Result.failed(`Redis did not respond within ${timeout}ms`, connection.lastError))
    }, timeout)
  })

  const probe = async () => {
    if (connection.status === 'connecting') {
      await new Promise<void>((resolve) => {
        onStatusChange = resolve
        statusEvents.forEach((event) => ioConnection.once(event, onStatusChange))
      })

      if (!connection.isReady()) {
        return Result.failed('Unable to connect to the redis server', connection.lastError)
      }
    }

    await connection.ping()
    return action()
  }

  /**
   * On timeout, the ping stays in the ioredis queue until the server
   * answers or the socket closes, so each timed out run on a silent
   * connection leaves one PING behind. The application's own commands
   * pile up on that connection the same way.
   */
  try {
    return await Promise.race([probe(), timedOut])
  } catch (error) {
    return Result.failed(error)
  } finally {
    clearTimeout(timer)
    statusEvents.forEach((event) => ioConnection.off(event, onStatusChange))
  }
}
