import { Card } from '@/lib/cards'
import { FloatingScore } from './FloatingScore'
import type { Trick, Player } from '@/game/types'
import type { CardBackStyle } from '@/lib/cards/cardBackStyles'
import { CARD_VALUES } from '@/game/types'

interface TrickAreaProps {
  trick: Trick
  players: Player[]
  showingResult?: boolean
  cardBackStyle?: CardBackStyle
}

export function TrickArea({ trick, players, showingResult = false, cardBackStyle = 'classic' }: TrickAreaProps) {
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

  // Get animation start position based on which player played the card
  const getCardFlyOrigin = (playerIndex: number, totalPlayers: number) => {
    if (totalPlayers === 4) {
      const origins = [
        'translateY(120px) scale(0.8)',     // bottom (me) - comes from below
        'translateX(100px) scale(0.8)',     // right - comes from right
        'translateY(-120px) scale(0.8)',    // top (partner) - comes from above
        'translateX(-100px) scale(0.8)',    // left - comes from left
      ]
      return origins[playerIndex]
    } else {
      const origins = [
        'translateY(120px) scale(0.8)',     // bottom (me) - comes from below
        'translateY(-120px) scale(0.8)',    // top (opponent) - comes from above
      ]
      return origins[playerIndex]
    }
  }

  const trickPoints = trick.cards.reduce((sum, play) => sum + CARD_VALUES[play.card.rank], 0)

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto">
      {/* Played cards */}
      {trick.cards.map(({ playerId, card }, index) => {
        const playerIndex = players.findIndex(p => p.id === playerId)
        const position = getPosition(playerIndex, players.length)
        const isWinner = showingResult && trick.winnerId === playerId
        const isLatestCard = !showingResult && index === trick.cards.length - 1
        const flyOrigin = getCardFlyOrigin(playerIndex, players.length)
        
        return (
          <div
            key={`${playerId}-${card.suit}-${card.rank}`}
            className={`absolute ${position} ${isLatestCard ? 'animate-card-fly' : ''} ${isWinner ? 'animate-winner-glow rounded-lg' : ''}`}
            style={isLatestCard ? { '--start-transform': flyOrigin } as React.CSSProperties : undefined}
          >
            <Card card={card} disabled backStyle={cardBackStyle} />
          </div>
        )
      })}
      
      {/* Floating score when trick is complete */}
      {showingResult && trick.winnerId && (
        <FloatingScore points={trickPoints} />
      )}
    </div>
  )
}
