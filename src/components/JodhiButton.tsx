import { useState } from 'react'
import type { Suit } from '@/game/types'

interface JodhiButtonProps {
  calledJodhiSuits: Suit[]
  onCallJodhi: (suit: Suit) => void
  disabled: boolean
}

const SUITS: { suit: Suit; symbol: string; color: string }[] = [
  { suit: 'hearts', symbol: '♥', color: 'text-red-600' },
  { suit: 'diamonds', symbol: '♦', color: 'text-red-600' },
  { suit: 'clubs', symbol: '♣', color: 'text-retro-black' },
  { suit: 'spades', symbol: '♠', color: 'text-retro-black' },
]

export function JodhiButton({ calledJodhiSuits, onCallJodhi, disabled }: JodhiButtonProps) {
  const [showSuits, setShowSuits] = useState(false)
  
  const availableSuits = SUITS.filter(s => !calledJodhiSuits.includes(s.suit))
  
  if (availableSuits.length === 0) return null
  
  if (!showSuits) {
    return (
      <button
        onClick={() => setShowSuits(true)}
        disabled={disabled}
        className="btn-retro text-xs"
      >
        👑 JODHI
      </button>
    )
  }
  
  return (
    <div className="card-container p-2 space-y-2">
      <p className="font-retro text-xs text-retro-black text-center">CALL JODHI</p>
      <div className="flex gap-2 justify-center">
        {availableSuits.map(({ suit, symbol, color }) => (
          <button
            key={suit}
            onClick={() => {
              onCallJodhi(suit)
              setShowSuits(false)
            }}
            disabled={disabled}
            className={`btn-retro text-lg px-3 py-1 ${color}`}
          >
            {symbol}
          </button>
        ))}
      </div>
      <button
        onClick={() => setShowSuits(false)}
        className="text-xs text-gray-500 underline w-full"
      >
        Cancel
      </button>
    </div>
  )
}
