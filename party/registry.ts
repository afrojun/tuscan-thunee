/**
 * Type-safe message handler registry for WebSocket messages.
 */

import type * as Party from "partykit/server"
import type { ClientMessage } from "../src/game/types"

/**
 * Context passed to each message handler.
 */
export interface MessageContext<TServer = unknown> {
  server: TServer
  playerId: string
  conn: Party.Connection
}

/**
 * Extract specific message type from the ClientMessage union.
 */
export type MessageOfType<T extends ClientMessage['type']> = Extract<ClientMessage, { type: T }>

/**
 * Typed handler that knows its exact message shape.
 */
export type TypedHandler<T extends ClientMessage['type'], TServer = unknown> = (
  ctx: MessageContext<TServer>,
  msg: MessageOfType<T>
) => void | Promise<void>

/**
 * Generic handler for the Map (erases specific type info).
 */
export type MessageHandler<TServer = unknown> = (
  ctx: MessageContext<TServer>,
  msg: ClientMessage
) => void | Promise<void>

/**
 * Type-safe helper to register a handler with correct message typing.
 * @example
 * handler('bid', (ctx, msg) => {
 *   // msg is typed as { type: 'bid', amount: number }
 *   console.log(msg.amount)
 * })
 */
export function handler<T extends ClientMessage['type'], TServer = unknown>(
  type: T,
  fn: TypedHandler<T, TServer>
): [T, MessageHandler<TServer>] {
  return [type, fn as MessageHandler<TServer>]
}
