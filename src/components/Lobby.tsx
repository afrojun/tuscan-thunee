import { useState } from 'react'
import type { GameState } from '@/game/types'

interface LobbyProps {
  gameId: string
  gameState: GameState | null
  playerName: string
  hasJoined: boolean
  onJoin: (name: string) => void
  onStart: () => void
}

export function Lobby({ gameId, gameState, hasJoined, onJoin, onStart }: LobbyProps) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onJoin(name.trim())
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  const currentPlayers = gameState?.players.length ?? 0
  // Only trust playerCount after at least one player has joined
  const expectedPlayers = currentPlayers > 0 ? gameState!.playerCount : null
  const canStart = expectedPlayers !== null && currentPlayers === expectedPlayers

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
      <h1 className="font-retro text-xl text-retro-gold">GAME LOBBY</h1>

      <div className="card-container p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-retro-black text-sm">CODE:</span>
          <div className="flex items-center gap-2">
            <span className="font-retro text-lg text-retro-black tracking-widest">
              {gameId}
            </span>
            <button
              onClick={copyLink}
              className="px-2 py-1 text-xs bg-felt text-retro-cream border border-retro-black"
            >
              COPY
            </button>
          </div>
        </div>

        <div className="border-t-2 border-retro-black pt-4">
          <p className="font-mono text-sm text-retro-black mb-2">
            Players ({currentPlayers}/{expectedPlayers ?? '?'}):
          </p>
          <ul className="space-y-1 mb-4">
            {gameState?.players.map((p, i) => (
              <li 
                key={p.id} 
                className={`font-mono text-sm px-2 py-1 ${
                  i % 2 === 0 ? 'bg-felt/20' : 'bg-retro-red/20'
                } ${!p.connected ? 'opacity-50' : ''}`}
              >
                <span className="text-retro-black">
                  {p.name} {p.id === gameState.dealerId && '👑'}
                </span>
                <span className="text-gray-500 text-xs ml-2">
                  Team {p.team + 1}
                </span>
              </li>
            ))}
            {expectedPlayers !== null && Array.from({ length: expectedPlayers - currentPlayers }).map((_, i) => (
              <li key={`empty-${i}`} className="font-mono text-sm text-gray-400 px-2 py-1">
                Waiting...
              </li>
            ))}
          </ul>

          {!hasJoined ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={12}
                autoFocus
                className="w-full px-3 py-2 bg-white text-retro-black font-mono
                           border-2 border-retro-black"
              />
              <button type="submit" className="btn-retro w-full">
                JOIN GAME
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="font-mono text-sm text-gray-600 text-center">
                {canStart ? 'Ready to start!' : 'Waiting for players...'}
              </p>
              {canStart && (
                <button 
                  className="btn-retro w-full"
                  onClick={onStart}
                >
                  START GAME
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {gameState && gameState.spectators.length > 0 && (
        <p className="font-mono text-xs text-retro-cream/60">
          {gameState.spectators.length} spectator(s) watching
        </p>
      )}
    </div>
  )
}
