import { useState, useEffect, useCallback, useRef } from 'react'
import PartySocket from 'partysocket'
import type { GameState, ClientMessage, ServerMessage } from '@/game/types'
import { deserializeState } from '@/game/state'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999'

export function usePartySocket(gameId: string) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string>('')
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<PartySocket | null>(null)

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: gameId,
    })

    socketRef.current = socket

    socket.addEventListener('open', () => {
      setConnected(true)
    })

    socket.addEventListener('close', () => {
      setConnected(false)
    })

    socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage & { playerId: string }
        
        if (msg.playerId) {
          setPlayerId(msg.playerId)
        }

        if (msg.type === 'state') {
          // Handle Set deserialization
          const state = typeof msg.state === 'string' 
            ? deserializeState(msg.state)
            : {
                ...msg.state,
                bidState: {
                  ...msg.state.bidState,
                  passed: new Set(
                    msg.state.bidState.passed instanceof Set 
                      ? msg.state.bidState.passed 
                      : Array.isArray(msg.state.bidState.passed)
                        ? msg.state.bidState.passed
                        : (msg.state.bidState.passed as { values?: string[] })?.values || []
                  )
                }
              }
          setGameState(state)
        }
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    })

    return () => {
      socket.close()
    }
  }, [gameId])

  const send = useCallback((msg: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { gameState, playerId, send, connected }
}
