import type { CardBackStyle } from '@/lib/cards/cardBackStyles'
import { CARD_BACK_STYLES } from '@/lib/cards/cardBackStyles'
import { CardBack } from '@/lib/cards'

interface CardBackSelectorProps {
  selected: CardBackStyle
  onChange: (style: CardBackStyle) => void
}

export function CardBackSelector({ selected, onChange }: CardBackSelectorProps) {
  const styles: CardBackStyle[] = ['classic', 'arcade', 'ornamental', 'minimal', 'felt']

  return (
    <div className="space-y-3">
      <h3 className="font-retro text-xs text-retro-black">CARD BACK STYLE</h3>
      
      <div className="grid grid-cols-5 gap-2">
        {styles.map((style) => (
          <button
            key={style}
            onClick={() => onChange(style)}
            className={`
              flex flex-col items-center gap-1 p-2 rounded border-2 transition-all
              ${selected === style
                ? 'border-retro-gold bg-retro-gold/10'
                : 'border-retro-black hover:border-retro-gold'
              }
            `}
            title={CARD_BACK_STYLES[style].description}
          >
            <div className="w-12 h-16">
              <CardBack style={style} small />
            </div>
            <span className="font-mono text-xs text-retro-black text-center leading-tight">
              {CARD_BACK_STYLES[style].name}
            </span>
          </button>
        ))}
      </div>

      <p className="font-mono text-xs text-gray-500 text-center">
        {CARD_BACK_STYLES[selected].description}
      </p>
    </div>
  )
}
