import { Card } from './Card'
import type { Card as CardType } from '@/game/types'

interface PlayerHandProps {
  cards: CardType[]
  onPlayCard: (card: CardType) => void
  isCurrentPlayer: boolean
  disabled?: boolean
}

export function PlayerHand({ cards, onPlayCard, isCurrentPlayer, disabled }: PlayerHandProps) {
  const cardCount = cards.length
  
  // Calculate fan angles - spread cards across ~60 degrees total
  const totalSpread = Math.min(60, cardCount * 12) // Max 60 degree spread
  const startAngle = -totalSpread / 2
  const angleStep = cardCount > 1 ? totalSpread / (cardCount - 1) : 0

  return (
    <div className="flex justify-center px-4">
      <div className="relative flex items-end justify-center" style={{ height: '140px' }}>
        {cards.map((card, i) => {
          const angle = cardCount === 1 ? 0 : startAngle + (i * angleStep)
          // Cards at edges are slightly lower (arc effect)
          const centerOffset = Math.abs(i - (cardCount - 1) / 2)
          const yOffset = centerOffset * centerOffset * 2
          
          return (
            <div 
              key={`${card.suit}-${card.rank}`}
              className="absolute group"
              style={{ 
                transform: `translateX(${(i - (cardCount - 1) / 2) * 45}px) translateY(${yOffset}px) rotate(${angle}deg)`,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              {/* Invisible hitbox that doesn't move - pointer-events-none so clicks pass through */}
              <div 
                className="absolute inset-0 z-10 pointer-events-none"
                style={{ 
                  top: '-20px',
                  bottom: '-10px',
                  left: '-5px',
                  right: '-5px',
                }}
              />
              {/* Card that lifts on hover */}
              <div className="transition-transform duration-150 group-hover:-translate-y-4 group-hover:z-50">
                <Card
                  card={card}
                  onClick={() => onPlayCard(card)}
                  disabled={disabled || !isCurrentPlayer}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
