import type { Card, Suit, Rank } from './types'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: Rank[] = ['J', '9', 'A', '10', 'K', 'Q']

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function dealCards(
  deck: Card[],
  playerCount: 2 | 4,
  phase: 'first' | 'second'
): Card[][] {
  if (playerCount === 4) {
    // 4 players: 4 cards first, then 2 cards
    const cardsPerPlayer = phase === 'first' ? 4 : 2
    const hands: Card[][] = [[], [], [], []]
    
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (let p = 0; p < 4; p++) {
        const cardIndex = i * 4 + p
        if (deck[cardIndex]) {
          hands[p].push(deck[cardIndex])
        }
      }
    }
    return hands
  } else {
    // 2 players: each gets 12 cards total, played in 2 rounds
    // Each round: 4 cards first, then 2 cards (like 4-player)
    const cardsPerPlayer = phase === 'first' ? 4 : 2
    const hands: Card[][] = [[], []]
    
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (let p = 0; p < 2; p++) {
        const cardIndex = i * 2 + p
        if (deck[cardIndex]) {
          hands[p].push(deck[cardIndex])
        }
      }
    }
    return hands
  }
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

export function cardToString(card: Card): string {
  const suitSymbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }
  return `${card.rank}${suitSymbols[card.suit]}`
}
