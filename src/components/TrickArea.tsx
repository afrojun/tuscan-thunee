import { Card } from './Card'
import type { Trick, Player } from '@/game/types'

interface TrickAreaProps {
  trick: Trick
  players: Player[]
  showingResult?: boolean
}

export function TrickArea({ trick, players, showingResult = false }: TrickAreaProps) {
  // For 4 players: position cards at top, right, bottom, left
  // For 2 players: position at top and bottom
  const getPosition = (playerIndex: number, totalPlayers: number) => {
    if (totalPlayers === 4) {
      const positions = [
        'bottom-2 left-1/2 -translate-x-1/2',    // bottom (me)
        'right-2 top-1/2 -translate-y-1/2',      // right
        'top-2 left-1/2 -translate-x-1/2',       // top (partner)
        'left-2 top-1/2 -translate-y-1/2',       // left
      ]
      return positions[playerIndex]
    } else {
      const positions = [
        'bottom-2 left-1/2 -translate-x-1/2',    // bottom (me)
        'top-2 left-1/2 -translate-x-1/2',       // top (opponent)
      ]
      return positions[playerIndex]
    }
  }

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto">
      {/* Played cards */}
      {trick.cards.map(({ playerId, card }, index) => {
        const playerIndex = players.findIndex(p => p.id === playerId)
        const position = getPosition(playerIndex, players.length)
        const isWinner = showingResult && trick.winnerId === playerId
        const isLatestCard = !showingResult && index === trick.cards.length - 1
        
        return (
          <div
            key={`${playerId}-${card.suit}-${card.rank}`}
            className={`absolute ${position} ${isLatestCard ? 'animate-card-enter' : ''} ${isWinner ? 'animate-winner-glow rounded-lg' : ''}`}
          >
            <Card card={card} disabled />
          </div>
        )
      })}
    </div>
  )
}
