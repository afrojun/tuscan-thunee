import { Card } from './Card'
import type { Trick, Player, Suit } from '@/game/types'

interface TrickAreaProps {
  trick: Trick
  players: Player[]
  currentPlayerId: string | null
  trump: Suit | null
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export function TrickArea({ trick, players, currentPlayerId, trump }: TrickAreaProps) {
  // For 4 players: position cards at top, right, bottom, left
  // For 2 players: position at top and bottom
  const getPosition = (playerIndex: number, totalPlayers: number) => {
    if (totalPlayers === 4) {
      const positions = [
        'bottom-0 left-1/2 -translate-x-1/2 translate-y-2',
        'right-0 top-1/2 -translate-y-1/2 translate-x-2',
        'top-0 left-1/2 -translate-x-1/2 -translate-y-2',
        'left-0 top-1/2 -translate-y-1/2 -translate-x-2',
      ]
      return positions[playerIndex]
    } else {
      const positions = [
        'bottom-0 left-1/2 -translate-x-1/2 translate-y-2',
        'top-0 left-1/2 -translate-x-1/2 -translate-y-2',
      ]
      return positions[playerIndex]
    }
  }

  return (
    <div className="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto">
      {/* Trump indicator */}
      {trump && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                        font-retro text-2xl text-retro-gold/30">
          {SUIT_SYMBOLS[trump]}
        </div>
      )}

      {/* Current player indicator */}
      {currentPlayerId && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-8
                        font-mono text-xs text-retro-cream/60">
          {players.find(p => p.id === currentPlayerId)?.name}'s turn
        </div>
      )}

      {/* Played cards */}
      {trick.cards.map(({ playerId, card }) => {
        const playerIndex = players.findIndex(p => p.id === playerId)
        const position = getPosition(playerIndex, players.length)
        
        return (
          <div
            key={`${playerId}-${card.suit}-${card.rank}`}
            className={`absolute ${position}`}
          >
            <Card card={card} small disabled />
          </div>
        )
      })}
    </div>
  )
}
