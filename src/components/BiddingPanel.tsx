import { useState, useEffect } from 'react'
import type { BidState } from '@/game/types'

interface BiddingPanelProps {
  bidState: BidState
  currentCallerName: string | null
  hasPassed: boolean
  onBid: (amount: number) => void
  onPass: () => void
}

export function BiddingPanel({ 
  bidState,
  currentCallerName, 
  hasPassed,
  onBid, 
  onPass 
}: BiddingPanelProps) {
  const [timeLeft, setTimeLeft] = useState(0)
  const minBid = Math.max(10, bidState.currentBid + 10)
  const [selectedBid, setSelectedBid] = useState(minBid)

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

  return (
    <div className="card-container p-4 space-y-3 w-full max-w-xs">
      {/* Timer */}
      <div className="text-center">
        <div className={`font-retro text-2xl ${timeLeft <= 3 ? 'text-retro-red animate-pulse' : 'text-retro-black'}`}>
          {timeLeft}s
        </div>
        <p className="font-retro text-xs text-retro-black mt-1">CALLING</p>
      </div>

      {/* Current call info */}
      {bidState.currentBid > 0 ? (
        <p className="font-mono text-sm text-center text-retro-black">
          <span className="text-retro-red font-bold">{currentCallerName}</span> called {bidState.currentBid}
        </p>
      ) : (
        <p className="font-mono text-sm text-center text-gray-600">
          No calls yet
        </p>
      )}

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
