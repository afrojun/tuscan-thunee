import { useState } from 'react'
import type { Suit } from '@/game/types'

interface JodhiButtonProps {
  trump: Suit | null
  calledJodhiSuits: Suit[]
  onCallJodhi: (suit: Suit, withJack: boolean) => void
  disabled: boolean
}

const SUITS: { suit: Suit; symbol: string; color: string }[] = [
  { suit: 'hearts', symbol: '♥', color: 'text-red-600' },
  { suit: 'diamonds', symbol: '♦', color: 'text-red-600' },
  { suit: 'clubs', symbol: '♣', color: 'text-retro-black' },
  { suit: 'spades', symbol: '♠', color: 'text-retro-black' },
]

export function JodhiButton({ trump, calledJodhiSuits, onCallJodhi, disabled }: JodhiButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null)
  const [claimingJack, setClaimingJack] = useState(false)
  
  const availableSuits = SUITS.filter(s => !calledJodhiSuits.includes(s.suit))
  
  if (availableSuits.length === 0) return null
  
  const getPoints = (suit: Suit, withJack: boolean) => {
    const isTrump = suit === trump
    if (withJack) {
      return isTrump ? 50 : 30
    }
    return isTrump ? 40 : 20
  }

  const handleCall = () => {
    if (selectedSuit) {
      onCallJodhi(selectedSuit, claimingJack)
      setSelectedSuit(null)
    }
  }

  const handleClose = () => {
    setShowModal(false)
    setSelectedSuit(null)
    setClaimingJack(false)
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className="btn-retro text-xs"
      >
        👑 JODHI
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <div 
            className="card-container p-4 max-w-xs w-full space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-retro text-sm text-retro-black text-center">CALL JODHI</p>
            
            {/* Suit buttons - tap to select */}
            <div className="flex gap-2 justify-center flex-wrap">
              {SUITS.map(({ suit, symbol, color }) => {
                const isClaimed = calledJodhiSuits.includes(suit)
                const isSelected = selectedSuit === suit
                const points = getPoints(suit, isSelected && claimingJack)
                const isTrump = suit === trump
                
                return (
                  <button
                    key={suit}
                    onClick={() => setSelectedSuit(isSelected ? null : suit)}
                    disabled={disabled || isClaimed}
                    className={`px-3 py-2 font-mono text-sm border-2 transition-all
                      ${isClaimed 
                        ? 'bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed' 
                        : isSelected
                          ? `bg-retro-gold/30 border-retro-gold ${color}`
                          : `bg-retro-cream border-retro-black hover:bg-retro-gold/10 ${color}`
                      }
                      ${isTrump && !isClaimed ? 'ring-2 ring-retro-gold ring-offset-1' : ''}
                    `}
                  >
                    <span className="text-lg">{symbol}</span>
                    <span className="ml-1">{points}</span>
                    {isClaimed && <span className="ml-1">✓</span>}
                  </button>
                )
              })}
            </div>

            {/* Jack toggle */}
            <label className="flex items-center justify-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={claimingJack}
                onChange={(e) => setClaimingJack(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-mono text-sm text-retro-black">With Jack (+10)</span>
            </label>
            
            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCall}
                disabled={!selectedSuit}
                className={`btn-retro text-xs flex-1 ${!selectedSuit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {selectedSuit ? `Call ${getPoints(selectedSuit, claimingJack)}` : 'Select suit'}
              </button>
              <button
                onClick={handleClose}
                className="btn-retro text-xs px-4 bg-gray-200 text-retro-black"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
