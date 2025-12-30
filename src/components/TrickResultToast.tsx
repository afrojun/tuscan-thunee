import type { TrickResult, Suit } from '@/game/types'

interface TrickResultToastProps {
  result: TrickResult
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const SUIT_COLORS: Record<Suit, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-white',
  spades: 'text-white',
}

export function TrickResultToast({ result }: TrickResultToastProps) {
  const { winnerName, winningCard, points, reason } = result
  const reasonText = reason === 'trump' ? 'trump' : 'high card'

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in-out">
      <div className="bg-retro-black/90 border-2 border-retro-gold px-4 py-2 rounded-lg shadow-lg">
        <p className="font-retro text-retro-gold text-sm text-center">
          {winnerName} wins!
        </p>
        <p className="font-mono text-xs text-center text-retro-cream mt-1">
          <span className={SUIT_COLORS[winningCard.suit]}>
            {winningCard.rank}{SUIT_SYMBOLS[winningCard.suit]}
          </span>
          {' '}({reasonText}) • +{points} pts
        </p>
      </div>
    </div>
  )
}
