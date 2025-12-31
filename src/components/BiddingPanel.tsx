import { useState, useEffect } from 'react'
import type { BidState, Suit } from '@/game/types'

interface BiddingPanelProps {
  bidState: BidState
  playerId: string
  currentCallerName: string | null
  hasPassed: boolean
  onBid: (amount: number) => void
  onPass: () => void
  onPreselectTrump: (suit: Suit) => void
}

const SUITS: { suit: Suit; symbol: string; color: string }[] = [
  { suit: 'hearts', symbol: '♥', color: 'text-retro-red' },
  { suit: 'diamonds', symbol: '♦', color: 'text-retro-red' },
  { suit: 'clubs', symbol: '♣', color: 'text-retro-black' },
  { suit: 'spades', symbol: '♠', color: 'text-retro-black' },
]

export function BiddingPanel({ 
  bidState,
  playerId,
  currentCallerName, 
  hasPassed,
  onBid, 
  onPass,
  onPreselectTrump
}: BiddingPanelProps) {
  const [timeLeft, setTimeLeft] = useState(0)
  const minBid = Math.max(10, bidState.currentBid + 10)
  const [selectedBid, setSelectedBid] = useState(minBid)
  
  const isDefaultTrumper = playerId === bidState.defaultTrumperId
  const someoneHasCalled = bidState.currentBid > 0
  const timerRunning = bidState.timerEndsAt !== null
  const isCurrentBidder = playerId === bidState.bidderId

  // Update selected bid when min changes
  useEffect(() => {
    setSelectedBid(minBid)
  }, [minBid])

  // Timer countdown
  useEffect(() => {
    if (!bidState.timerEndsAt) {
      setTimeLeft(0)
      return
    }

    const updateTimer = () => {
      const remaining = Math.max(0, bidState.timerEndsAt! - Date.now())
      setTimeLeft(Math.ceil(remaining / 1000))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100)
    return () => clearInterval(interval)
  }, [bidState.timerEndsAt])

  const bidOptions = []
  for (let b = minBid; b <= 100; b += 10) {
    bidOptions.push(b)
  }
  if (bidState.currentBid < 104) {
    bidOptions.push(104)
  }

  // Default trumper who hasn't been challenged - show trump selection
  if (isDefaultTrumper && !someoneHasCalled) {
    return (
      <div className="card-container p-4 space-y-3 w-full max-w-xs">
        {/* Timer */}
        {timerRunning && (
          <div className="text-center">
            <div className={`font-retro text-2xl ${timeLeft <= 3 ? 'text-retro-red animate-pulse' : 'text-retro-black'}`}>
              {timeLeft}s
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="font-retro text-xs text-retro-black">SELECT TRUMP</p>
          <p className="font-mono text-[10px] text-gray-500 mt-1">
            Others can still call to challenge
          </p>
        </div>

        {/* Trump selection */}
        <div className="grid grid-cols-4 gap-2">
          {SUITS.map(({ suit, symbol, color }) => (
            <button
              key={suit}
              onClick={() => onPreselectTrump(suit)}
              className={`py-3 text-2xl border-2 border-retro-black 
                         ${bidState.preSelectedTrump === suit 
                           ? 'bg-retro-gold' 
                           : 'bg-retro-cream hover:bg-gray-100'} 
                         ${color}`}
            >
              {symbol}
            </button>
          ))}
        </div>

        {bidState.preSelectedTrump && (
          <p className="font-mono text-xs text-center text-gray-600">
            {SUITS.find(s => s.suit === bidState.preSelectedTrump)?.symbol} selected - waiting for timer...
          </p>
        )}

        <div className="border-t border-retro-black/30 pt-3">
          <p className="font-mono text-[10px] text-gray-500 text-center mb-2">
            Or call to increase the stakes:
          </p>
          <div className="flex flex-wrap gap-1 justify-center">
            {bidOptions.slice(0, 4).map((amount) => (
              <button
                key={amount}
                onClick={() => onBid(amount)}
                className="px-2 py-1 font-mono text-xs border border-retro-black bg-retro-cream text-retro-black"
              >
                {amount}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Current bidder (after calling) - show trump preselection while others can counter
  if (isCurrentBidder && someoneHasCalled) {
    return (
      <div className="card-container p-4 space-y-3 w-full max-w-xs">
        {/* Timer */}
        {timerRunning && (
          <div className="text-center">
            <div className={`font-retro text-2xl ${timeLeft <= 3 ? 'text-retro-red animate-pulse' : 'text-retro-black'}`}>
              {timeLeft}s
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="font-retro text-xs text-retro-black">YOU CALLED {bidState.currentBid}</p>
          <p className="font-mono text-[10px] text-gray-500 mt-1">
            Select trump while waiting for counter-calls
          </p>
        </div>

        {/* Trump selection */}
        <div className="grid grid-cols-4 gap-2">
          {SUITS.map(({ suit, symbol, color }) => (
            <button
              key={suit}
              onClick={() => onPreselectTrump(suit)}
              className={`py-3 text-2xl border-2 border-retro-black 
                         ${bidState.preSelectedTrump === suit 
                           ? 'bg-retro-gold' 
                           : 'bg-retro-cream hover:bg-gray-100'} 
                         ${color}`}
            >
              {symbol}
            </button>
          ))}
        </div>

        {bidState.preSelectedTrump && (
          <p className="font-mono text-xs text-center text-gray-600">
            {SUITS.find(s => s.suit === bidState.preSelectedTrump)?.symbol} selected - waiting for timer...
          </p>
        )}
      </div>
    )
  }

  // Non-trumper before anyone has called
  if (!someoneHasCalled && !isDefaultTrumper) {
    return (
      <div className="card-container p-4 space-y-3 w-full max-w-xs">
        {/* Timer */}
        {timerRunning && (
          <div className="text-center">
            <div className={`font-retro text-2xl ${timeLeft <= 3 ? 'text-retro-red animate-pulse' : 'text-retro-black'}`}>
              {timeLeft}s
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="font-retro text-xs text-retro-black">CALLING PHASE</p>
          <p className="font-mono text-xs text-gray-600 mt-1">
            Call to take trumping, or wait
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {bidOptions.slice(0, 6).map((amount) => (
            <button
              key={amount}
              onClick={() => setSelectedBid(amount)}
              className={`px-3 py-2 font-mono text-sm border-2 border-retro-black
                ${selectedBid === amount 
                  ? 'bg-retro-black text-retro-cream' 
                  : 'bg-retro-cream text-retro-black'}`}
            >
              {amount}
            </button>
          ))}
        </div>

        <button
          onClick={() => onBid(selectedBid)}
          className="btn-retro w-full"
        >
          CALL {selectedBid}
        </button>
      </div>
    )
  }

  // Someone has called - show timer and counter-call options
  return (
    <div className="card-container p-4 space-y-3 w-full max-w-xs">
      {/* Timer */}
      {timerRunning && (
        <div className="text-center">
          <div className={`font-retro text-2xl ${timeLeft <= 3 ? 'text-retro-red animate-pulse' : 'text-retro-black'}`}>
            {timeLeft}s
          </div>
          <p className="font-retro text-xs text-retro-black mt-1">CALLING</p>
        </div>
      )}

      {/* Current call info */}
      <p className="font-mono text-sm text-center text-retro-black">
        <span className="text-retro-red font-bold">{currentCallerName}</span> called {bidState.currentBid}
      </p>

      {/* Actions */}
      {hasPassed ? (
        <p className="font-mono text-sm text-center text-gray-500 py-4">
          You passed
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 justify-center">
            {bidOptions.slice(0, 6).map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedBid(amount)}
                className={`px-3 py-2 font-mono text-sm border-2 border-retro-black
                  ${selectedBid === amount 
                    ? 'bg-retro-black text-retro-cream' 
                    : 'bg-retro-cream text-retro-black'}`}
              >
                {amount}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onBid(selectedBid)}
              className="btn-retro flex-1"
            >
              CALL {selectedBid}
            </button>
            <button
              onClick={onPass}
              className="btn-danger flex-1"
            >
              PASS
            </button>
          </div>
        </>
      )}
    </div>
  )
}
