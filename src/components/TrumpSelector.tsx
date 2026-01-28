import type { Suit } from '@/game/types'

interface TrumpSelectorProps {
  onSelectTrump: (suit: Suit, lastCard?: boolean) => void
  onCallThunee: () => void
  isCurrentPlayer: boolean
}

const SUITS: { suit: Suit; symbol: string; color: string }[] = [
  { suit: 'hearts', symbol: '♥', color: 'text-retro-red' },
  { suit: 'diamonds', symbol: '♦', color: 'text-retro-red' },
  { suit: 'clubs', symbol: '♣', color: 'text-retro-black' },
  { suit: 'spades', symbol: '♠', color: 'text-retro-black' },
]

export function TrumpSelector({ onSelectTrump, onCallThunee, isCurrentPlayer }: TrumpSelectorProps) {
  if (!isCurrentPlayer) {
    return (
      <div className="card-container p-4 text-center">
        <p className="font-mono text-sm text-retro-black">
          Waiting for trump selection...
        </p>
      </div>
    )
  }

  return (
    <div className="card-container p-4 space-y-4">
      <p className="font-retro text-xs text-retro-black text-center flex items-center justify-center gap-2">
        <span className="text-base">🎺</span>
        SELECT TRUMP
      </p>

      <div className="grid grid-cols-4 gap-2">
        {SUITS.map(({ suit, symbol, color }) => (
          <button
            key={suit}
            onClick={() => onSelectTrump(suit)}
            className={`py-3 text-2xl border-2 border-retro-black bg-retro-cream
                       hover:bg-gray-100 ${color}`}
          >
            {symbol}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSelectTrump('hearts', true)}
          className="btn-retro flex-1 text-[10px]"
        >
          LAST CARD
        </button>
        <button
          onClick={onCallThunee}
          className="btn-danger flex-1 text-[10px]"
        >
          THUNEE!
        </button>
      </div>
    </div>
  )
}
