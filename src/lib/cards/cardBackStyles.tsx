// Card back style definitions
export type CardBackStyle = 'classic' | 'arcade' | 'ornamental' | 'minimal' | 'felt'

interface CardBackStyleConfig {
  name: string
  description: string
}

export const CARD_BACK_STYLES: Record<CardBackStyle, CardBackStyleConfig> = {
  classic: {
    name: 'Classic',
    description: 'Red/white crosshatch - timeless poker style',
  },
  arcade: {
    name: 'Arcade',
    description: 'CRT scan lines with glowing center - retro gaming vibes',
  },
  ornamental: {
    name: 'Ornamental',
    description: 'Gold trim with luxury felt aesthetic',
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean and modern with elegant simplicity',
  },
  felt: {
    name: 'Casino',
    description: 'Rich burgundy casino table style',
  },
}

export function getCardBackStyle(style: CardBackStyle): string {
  return style
}

export function getCardBackName(style: CardBackStyle): string {
  return CARD_BACK_STYLES[style].name
}

export function getCardBackDescription(style: CardBackStyle): string {
  return CARD_BACK_STYLES[style].description
}
