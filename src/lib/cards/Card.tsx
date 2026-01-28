import type { Suit } from './types'
import { SUIT_SYMBOLS } from './types'
import type { CardBackStyle } from './cardBackStyles'

const SUIT_CSS_COLORS: Record<Suit, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
}

// Subtle background tints for each suit (solid colors with white base)
const SUIT_BG_TINTS: Record<Suit, string> = {
  hearts: '#fff8f8',
  diamonds: '#fffaf6',
  clubs: '#f6fff8',
  spades: '#f8f8ff',
}

interface CardProps {
  /** Any card object with suit and rank */
  card: { suit: Suit; rank: string }
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  faceDown?: boolean
  small?: boolean
  backStyle?: CardBackStyle
}

export function Card({ 
  card, 
  onClick, 
  disabled = false, 
  selected = false,
  faceDown = false,
  small = false,
  backStyle = 'classic'
}: CardProps) {
  const sizeClasses = small 
    ? 'w-12 h-16' 
    : 'w-16 h-24 sm:w-20 sm:h-28'

  if (faceDown) {
    return (
      <div 
        className={`${sizeClasses} rounded-lg shadow-retro-sm overflow-hidden border border-gray-300 bg-white p-0.5`}
      >
        <CardBackPattern style={backStyle} />
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
        backgroundColor: SUIT_BG_TINTS[card.suit],
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

function CardBackPattern({ style = 'classic' }: { style: CardBackStyle }) {
  switch (style) {
    case 'arcade':
      return <ArcadeCardBack />
    case 'ornamental':
      return <OrnamentalCardBack />
    case 'minimal':
      return <MinimalCardBack />
    case 'felt':
      return <FeltCardBack />
    case 'classic':
    default:
      return <ClassicCardBack />
  }
}

function ClassicCardBack() {
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

function ArcadeCardBack() {
  return (
    <div
      className="w-full h-full rounded border-2 border-yellow-500 overflow-hidden flex items-center justify-center"
      style={{
        backgroundColor: '#1a1a1a',
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 1px,
            rgba(255, 255, 0, 0.1) 1px,
            rgba(255, 255, 0, 0.1) 2px
          )
        `,
      }}
    >
      <div className="text-center">
        <div 
          className="text-3xl font-bold"
          style={{
            color: '#ffff00',
            textShadow: '0 0 10px rgba(255, 255, 0, 0.8), 0 0 20px rgba(255, 165, 0, 0.6)',
          }}
        >
          ◆
        </div>
      </div>
    </div>
  )
}

function OrnamentalCardBack() {
  return (
    <div 
      className="w-full h-full rounded border-2 border-yellow-600 overflow-hidden flex items-center justify-center relative"
      style={{
        backgroundColor: '#2d5016',
        backgroundImage: `
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(212, 168, 71, 0.05) 2px,
            rgba(212, 168, 71, 0.05) 4px
          )
        `,
      }}
    >
      {/* Gold corner decorations */}
      <div 
        className="absolute"
        style={{
          width: '100%',
          height: '100%',
          backgroundImage: `
            linear-gradient(135deg, transparent 6px, #d4a847 6px, #d4a847 8px, transparent 8px),
            linear-gradient(-135deg, transparent 6px, #d4a847 6px, #d4a847 8px, transparent 8px),
            linear-gradient(45deg, transparent 6px, #d4a847 6px, #d4a847 8px, transparent 8px),
            linear-gradient(-45deg, transparent 6px, #d4a847 6px, #d4a847 8px, transparent 8px)
          `,
          backgroundPosition: 'top left, top right, bottom left, bottom right',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="text-center relative z-10">
        <div className="text-4xl font-bold text-yellow-600" style={{ textShadow: '0 0 8px rgba(212, 168, 71, 0.6)' }}>
          ◆
        </div>
      </div>
    </div>
  )
}

function MinimalCardBack() {
  return (
    <div 
      className="w-full h-full rounded border-2 border-yellow-600 overflow-hidden flex items-center justify-center"
      style={{
        backgroundColor: '#1a1a1a',
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-yellow-600" style={{ aspectRatio: '1' }} />
        <div className="w-4 h-px bg-yellow-600" />
      </div>
    </div>
  )
}

function FeltCardBack() {
  return (
    <div 
      className="w-full h-full rounded border-2 border-amber-700 overflow-hidden flex items-center justify-center relative"
      style={{
        backgroundColor: '#8b1538',
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0, 0, 0, 0.08) 3px,
            rgba(0, 0, 0, 0.08) 6px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 3px,
            rgba(0, 0, 0, 0.05) 3px,
            rgba(0, 0, 0, 0.05) 6px
          )
        `,
      }}
    >
      {/* Corner diamonds */}
      <div className="absolute top-1 left-1 text-amber-400 text-[8px]">♦</div>
      <div className="absolute top-1 right-1 text-amber-400 text-[8px]">♦</div>
      <div className="absolute bottom-1 left-1 text-amber-400 text-[8px]">♦</div>
      <div className="absolute bottom-1 right-1 text-amber-400 text-[8px]">♦</div>
      
      {/* Center oval with T */}
      <div 
        className="w-8 h-10 rounded-full border-2 border-amber-400 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
      >
        <span className="text-amber-400 font-retro text-lg" style={{ textShadow: '0 0 4px rgba(251, 191, 36, 0.5)' }}>
          T
        </span>
      </div>
    </div>
  )
}

export function CardBack({ small = false, style = 'classic' }: { small?: boolean; style?: CardBackStyle }) {
  const sizeClasses = small 
    ? 'w-12 h-16' 
    : 'w-16 h-24 sm:w-20 sm:h-28'

  return (
    <div 
      className={`${sizeClasses} rounded-lg shadow-retro-sm overflow-hidden border border-gray-300 bg-white p-0.5`}
    >
      <CardBackPattern style={style} />
    </div>
  )
}
