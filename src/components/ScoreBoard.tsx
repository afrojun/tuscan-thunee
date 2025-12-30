import { useState } from 'react'
import type { TeamScore, Player, GamePhase, Suit, Trick, Card } from '@/game/types'
import { CARD_VALUES } from '@/game/types'

interface JodhiCall {
  playerId: string
  points: number
  suit: Suit
  hasJack: boolean
}

interface ScoreBoardProps {
  teams: [TeamScore, TeamScore]
  players: Player[]
  currentBid: number
  playerCount?: 2 | 4
  dealRound?: number
  phase?: GamePhase
  jodhiCalls?: JodhiCall[]
  trickHistory?: Trick[]
  trump?: Suit | null
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
  clubs: 'text-retro-black',
  spades: 'text-retro-black',
}

function getTrickPoints(trick: Trick): number {
  return trick.cards.reduce((sum, play) => sum + CARD_VALUES[play.card.rank], 0)
}

function formatCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`
}

export function ScoreBoard({ 
  teams, 
  players, 
  currentBid, 
  playerCount, 
  dealRound, 
  phase, 
  jodhiCalls = [],
  trickHistory = [],
  trump
}: ScoreBoardProps) {
  const [showHistory, setShowHistory] = useState(false)
  
  const team0Players = players.filter(p => p.team === 0).map(p => p.name).join(' & ')
  const team1Players = players.filter(p => p.team === 1).map(p => p.name).join(' & ')
  const showRoundIndicator = playerCount === 2 && phase === 'playing'
  
  const getTeamJodhis = (team: 0 | 1) => {
    return jodhiCalls.filter(j => {
      const player = players.find(p => p.id === j.playerId)
      return player?.team === team
    })
  }
  
  const team0Jodhis = getTeamJodhis(0)
  const team1Jodhis = getTeamJodhis(1)

  const getWinnerName = (winnerId: string | null) => {
    if (!winnerId) return '?'
    return players.find(p => p.id === winnerId)?.name ?? '?'
  }

  const getWinningCard = (trick: Trick) => {
    if (!trick.winnerId) return null
    return trick.cards.find(c => c.playerId === trick.winnerId)?.card
  }

  const getWinReason = (trick: Trick): string => {
    const winningCard = getWinningCard(trick)
    if (!winningCard) return ''
    if (trump && winningCard.suit === trump) return 'trump'
    return 'high'
  }

  return (
    <div className="relative">
      <div 
        className="card-container p-3 sm:p-4 cursor-pointer select-none"
        onClick={() => setShowHistory(!showHistory)}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="font-retro text-sm sm:text-base text-retro-black truncate">
              {team0Players || 'Team 1'}
            </div>
            <div className="flex justify-between font-mono text-base sm:text-lg text-retro-black">
              <span>Balls:</span>
              <span className="font-bold text-lg sm:text-xl">{teams[0].balls}/13</span>
            </div>
            <div className="flex justify-between font-mono text-sm sm:text-base text-gray-600">
              <span>Points:</span>
              <span>{teams[0].cardPoints}</span>
            </div>
            {team0Jodhis.length > 0 && (
              <div className="font-mono text-xs text-retro-gold">
                Jodhi: {team0Jodhis.map(j => `${SUIT_SYMBOLS[j.suit]}${j.points}`).join(' ')}
              </div>
            )}
          </div>
          
          <div className="space-y-1 border-l-2 border-retro-black pl-4">
            <div className="font-retro text-sm sm:text-base text-retro-black truncate">
              {team1Players || 'Team 2'}
            </div>
            <div className="flex justify-between font-mono text-base sm:text-lg text-retro-black">
              <span>Balls:</span>
              <span className="font-bold text-lg sm:text-xl">{teams[1].balls}/13</span>
            </div>
            <div className="flex justify-between font-mono text-sm sm:text-base text-gray-600">
              <span>Points:</span>
              <span>{teams[1].cardPoints}</span>
            </div>
            {team1Jodhis.length > 0 && (
              <div className="font-mono text-xs text-retro-gold">
                Jodhi: {team1Jodhis.map(j => `${SUIT_SYMBOLS[j.suit]}${j.points}`).join(' ')}
              </div>
            )}
          </div>
        </div>

        {(currentBid > 0 || showRoundIndicator) && (
          <div className="mt-2 pt-2 border-t border-retro-black/30 flex justify-center gap-4 font-mono text-sm sm:text-base text-gray-600">
            {currentBid > 0 && (
              <span>Call: <span className="font-bold">{currentBid}</span></span>
            )}
            {showRoundIndicator && (
              <span>Round <span className="font-bold">{dealRound}/2</span></span>
            )}
          </div>
        )}

        {/* Tap indicator */}
        <div className="absolute bottom-1 right-2 text-xs text-gray-400">
          {showHistory ? '▲' : '▼'}
        </div>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="card-container mt-1 p-3 max-h-48 overflow-y-auto">
          <p className="font-retro text-xs text-retro-black mb-2">TRICK HISTORY</p>
          {trickHistory.length === 0 ? (
            <p className="font-mono text-xs text-gray-500">No tricks played yet</p>
          ) : (
            <div className="space-y-1">
              {[...trickHistory].reverse().map((trick, idx) => {
                const winningCard = getWinningCard(trick)
                const points = getTrickPoints(trick)
                const reason = getWinReason(trick)
                const trickNum = trickHistory.length - idx
                
                return (
                  <div key={idx} className="font-mono text-xs flex items-center gap-2 border-b border-gray-200 pb-1">
                    <span className="text-gray-400 w-5">#{trickNum}</span>
                    <span className="text-gray-400">
                      {trick.cards.map((c, i) => (
                        <span key={i} className={SUIT_COLORS[c.card.suit]}>
                          {formatCard(c.card)}{i < trick.cards.length - 1 ? '·' : ''}
                        </span>
                      ))}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="font-bold text-retro-black truncate">
                      {getWinnerName(trick.winnerId)}
                    </span>
                    {winningCard && (
                      <span className={SUIT_COLORS[winningCard.suit]}>
                        {formatCard(winningCard)}{reason === 'trump' && '🎺'}
                      </span>
                    )}
                    <span className="text-gray-600 ml-auto">+{points}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
