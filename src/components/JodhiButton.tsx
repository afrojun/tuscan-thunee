import type { Card, Suit } from '@/game/types'

interface JodhiButtonProps {
  hand: Card[]
  trump: Suit | null
  calledJodhiSuits: Suit[]
  onCallJodhi: (suit: Suit) => void
  disabled: boolean
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export function JodhiButton({ hand, trump, calledJodhiSuits, onCallJodhi, disabled }: JodhiButtonProps) {
  const availableJodhis: { suit: Suit; points: number; hasJack: boolean }[] = []
  
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  
  for (const suit of suits) {
    if (calledJodhiSuits.includes(suit)) continue
    
    const hasQ = hand.some(c => c.suit === suit && c.rank === 'Q')
    const hasK = hand.some(c => c.suit === suit && c.rank === 'K')
    const hasJ = hand.some(c => c.suit === suit && c.rank === 'J')
    
    if (hasQ && hasK) {
      const isTrump = suit === trump
      let points: number
      if (hasJ) {
        points = isTrump ? 50 : 30
      } else {
        points = isTrump ? 40 : 20
      }
      availableJodhis.push({ suit, points, hasJack: hasJ })
    }
  }
  
  if (availableJodhis.length === 0) return null
  
  return (
    <div className="card-container p-2 space-y-2">
      <p className="font-retro text-xs text-retro-black text-center">CALL JODHI</p>
      <div className="flex gap-2 justify-center flex-wrap">
        {availableJodhis.map(({ suit, points }) => (
          <button
            key={suit}
            onClick={() => onCallJodhi(suit)}
            disabled={disabled}
            className={`btn-retro text-xs px-3 py-1 ${
              suit === 'hearts' || suit === 'diamonds' 
                ? 'text-red-600' 
                : 'text-black'
            }`}
          >
            {SUIT_SYMBOLS[suit]} {points}
          </button>
        ))}
      </div>
    </div>
  )
}
