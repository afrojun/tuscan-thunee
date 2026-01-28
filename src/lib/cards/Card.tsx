import type { Suit } from './types'
import { SUIT_SYMBOLS } from './types'

const SUIT_CSS_COLORS: Record<Suit, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
}

interface CardProps {
  /** Any card object with suit and rank */
  card: { suit: Suit; rank: string }
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  faceDown?: boolean
  small?: boolean
}

export function Card({ 
  card, 
  onClick, 
  disabled = false, 
  selected = false,
  faceDown = false,
  small = false 
}: CardProps) {
  const sizeClasses = small 
    ? 'w-12 h-16' 
    : 'w-16 h-24 sm:w-20 sm:h-28'

  if (faceDown) {
    return (
      <div 
        className={`${sizeClasses} rounded-lg shadow-retro-sm overflow-hidden border border-gray-300 bg-white p-1`}
      >
        <CardBackPattern />
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses}
        bg-white border-2 border-gray-300 rounded-lg shadow-md
        flex flex-col items-center justify-center gap-0
        transition-all duration-150 relative
        ${!disabled 
          ? 'hover:-translate-y-3 hover:scale-105 hover:shadow-xl hover:border-retro-gold/50 cursor-pointer active:scale-95' 
          : 'cursor-default'}
        ${selected ? '-translate-y-3 ring-2 ring-retro-gold' : ''}
        ${SUIT_CSS_COLORS[card.suit]}
      `}
      style={{
        backgroundImage: `
          linear-gradient(135deg, transparent 8px, #d4a847 8px, #d4a847 10px, transparent 10px),
          linear-gradient(-135deg, transparent 8px, #d4a847 8px, #d4a847 10px, transparent 10px),
          linear-gradient(45deg, transparent 8px, #d4a847 8px, #d4a847 10px, transparent 10px),
          linear-gradient(-45deg, transparent 8px, #d4a847 8px, #d4a847 10px, transparent 10px)
        `,
        backgroundPosition: 'top left, top right, bottom left, bottom right',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <span className={`font-bold leading-none ${small ? 'text-xl' : 'text-3xl sm:text-4xl'}`}>
        {card.rank}
      </span>
      <span className={`leading-none ${small ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  )
}

function CardBackPattern() {
  return (
    <div 
      className="w-full h-full rounded border-2 border-red-800 overflow-hidden"
      style={{
        backgroundColor: '#fff',
        backgroundImage: `
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            #dc2626 4px,
            #dc2626 5px
          ),
          repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            #dc2626 4px,
            #dc2626 5px
          )
        `,
      }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-6 h-6 bg-white rounded-full border-2 border-red-800 flex items-center justify-center shadow-sm">
          <span className="text-red-700 text-xs font-bold">♦</span>
        </div>
      </div>
    </div>
  )
}

export function CardBack({ small = false }: { small?: boolean }) {
  const sizeClasses = small 
    ? 'w-12 h-16' 
    : 'w-16 h-24 sm:w-20 sm:h-28'

  return (
    <div 
      className={`${sizeClasses} rounded-lg shadow-retro-sm overflow-hidden border border-gray-300 bg-white p-1`}
    >
      <CardBackPattern />
    </div>
  )
}
