/**
 * Generic card types that can be used across different card games.
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export const SUIT_COLORS: Record<Suit, 'red' | 'black'> = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
}

/**
 * Generic card interface. Games define their own Rank type.
 */
export interface Card<R extends string = string> {
  suit: Suit
  rank: R
}
