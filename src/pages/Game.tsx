import { useParams, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Lobby } from '@/components/Lobby'
import { GameBoard } from '@/components/GameBoard'
import { usePartySocket } from '@/hooks/usePartySocket'

function getStoredPlayerId(gameId: string): string | null {
  return localStorage.getItem(`thunee-player-${gameId}`)
}

function storePlayerId(gameId: string, playerId: string) {
  localStorage.setItem(`thunee-player-${gameId}`, playerId)
}

function getStoredPlayerName(gameId: string): string | null {
  return localStorage.getItem(`thunee-name-${gameId}`)
}

function storePlayerName(gameId: string, name: string) {
  localStorage.setItem(`thunee-name-${gameId}`, name)
}

export function Game() {
  const { gameId } = useParams<{ gameId: string }>()
  const [searchParams] = useSearchParams()
  const playerCount = (searchParams.get('players') === '2' ? 2 : 4) as 2 | 4
  
  const [playerName, setPlayerName] = useState(() => getStoredPlayerName(gameId!) || '')
  const [hasJoined, setHasJoined] = useState(false)
  
  const { gameState, playerId, send, connected } = usePartySocket(gameId!)

  // Store playerId when we get one
  useEffect(() => {
    if (playerId && gameId) {
      storePlayerId(gameId, playerId)
    }
  }, [playerId, gameId])

  // Auto-rejoin if we have stored credentials and game is in progress
  useEffect(() => {
    if (connected && gameState && !hasJoined) {
      const storedName = getStoredPlayerName(gameId!)
      const storedPlayerId = getStoredPlayerId(gameId!)
      
      // Check if we're already in the game
      const existingPlayer = gameState.players.find(
        p => p.id === storedPlayerId || p.name === storedName
      )
      
      if (existingPlayer && storedName) {
        setPlayerName(storedName)
        send({ type: 'join', name: storedName, playerCount, existingPlayerId: storedPlayerId || undefined })
        setHasJoined(true)
      }
    }
  }, [connected, gameState, hasJoined, gameId, send, playerCount])

  const handleJoin = (name: string) => {
    setPlayerName(name)
    storePlayerName(gameId!, name)
    const existingPlayerId = getStoredPlayerId(gameId!)
    send({ type: 'join', name, playerCount, existingPlayerId: existingPlayerId || undefined })
    setHasJoined(true)
  }

  const handleStart = () => {
    send({ type: 'start' })
  }

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-retro text-xs animate-pulse">CONNECTING...</p>
      </div>
    )
  }

  // Check if we're an existing player in the game
  const isExistingPlayer = gameState?.players.some(p => p.id === playerId)
  
  // Show lobby if not joined, or if game is in waiting phase and we're not already a player
  const showLobby = !hasJoined || !gameState || (gameState.phase === 'waiting' && !isExistingPlayer)
  
  if (showLobby) {
    return (
      <Lobby
        gameId={gameId!}
        gameState={gameState}
        playerName={playerName}
        hasJoined={hasJoined}
        onJoin={handleJoin}
        onStart={handleStart}
      />
    )
  }

  return (
    <GameBoard
      gameState={gameState}
      playerId={playerId}
      onAction={send}
    />
  )
}
