import { useState, useEffect } from 'react'
import type { BidState } from '@/game/types'

interface BiddingPanelProps {
  bidState: BidState
  isCurrentPlayer: boolean
  currentBidderName: string
  onBid: (amount: number) => void
  onPass: () => void
}

export function BiddingPanel({ bidState, isCurrentPlayer, currentBidderName, onBid, onPass }: BiddingPanelProps) {
  const minBid = Math.max(10, bidState.currentBid + 10)
  const [selectedBid, setSelectedBid] = useState(minBid)

  // Update selected bid when min changes
  useEffect(() => {
    setSelectedBid(minBid)
  }, [minBid])

  const bidOptions = []
  for (let b = minBid; b <= 100; b += 10) {
    bidOptions.push(b)
  }
  if (bidState.currentBid < 104) {
    bidOptions.push(104)
  }

  if (!isCurrentPlayer) {
    return (
      <div className="card-container p-4 text-center space-y-2">
        <p className="font-retro text-xs text-retro-black">BIDDING</p>
        <p className="font-mono text-sm text-retro-black">
          <span className="text-retro-red">{currentBidderName}</span>'s turn
        </p>
        {bidState.currentBid > 0 && (
          <p className="font-mono text-xs text-gray-600">
            Current bid: {bidState.currentBid}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="card-container p-4 space-y-3">
      <p className="font-retro text-xs text-retro-gold text-center">YOUR TURN TO BID</p>
      
      {bidState.currentBid > 0 && (
        <p className="font-mono text-xs text-gray-600 text-center">
          Current bid: {bidState.currentBid}
        </p>
      )}

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
          BID {selectedBid}
        </button>
        <button
          onClick={onPass}
          className="btn-danger flex-1"
        >
          PASS
        </button>
      </div>
    </div>
  )
}
