import { useState } from 'react'
import type { TeamScore, Player, GamePhase, Suit, Card, GameEvent } from '@/game/types'
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
  eventLog?: GameEvent[]
  trump?: Suit | null
  isKhanaakGame?: boolean
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
  eventLog = [],
  trump,
  isKhanaakGame = false
}: ScoreBoardProps) {
  const winThreshold = isKhanaakGame ? 13 : 12
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

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name ?? '?'
  }

  type TrickEventData = Extract<GameEvent, { type: 'trick' }>['data']
  
  const getWinningCard = (trick: TrickEventData) => {
    return trick.cards.find(c => c.playerId === trick.winnerId)?.card
  }

  const getWinReason = (trick: TrickEventData): string => {
    const winningCard = getWinningCard(trick)
    if (!winningCard) return ''
    if (trump && winningCard.suit === trump) return 'trump'
    return 'high'
  }

  const getTrickPointsFromData = (trick: TrickEventData): number => {
    return trick.cards.reduce((sum, play) => sum + CARD_VALUES[play.card.rank], 0)
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
              <span className="font-bold text-lg sm:text-xl">{teams[0].balls}/{winThreshold}</span>
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
              <span className="font-bold text-lg sm:text-xl">{teams[1].balls}/{winThreshold}</span>
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

        {(currentBid > 0 || showRoundIndicator || trump) && (
          <div className="mt-2 pt-2 border-t border-retro-black/30 flex justify-center gap-4 font-mono text-sm sm:text-base text-gray-600">
            {trump && (
              <span className="flex items-center gap-1">Trump: <span className={`font-bold text-xl leading-none ${SUIT_COLORS[trump]}`}>{SUIT_SYMBOLS[trump]}</span></span>
            )}
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
        <div className="card-container mt-1 p-3 max-h-64 overflow-y-auto">
          <p className="font-retro text-xs text-retro-black mb-2">GAME LOG</p>
          {eventLog.length === 0 ? (
            <p className="font-mono text-xs text-gray-500">No events yet</p>
          ) : (
            <div className="space-y-1">
              {[...eventLog].reverse().map((event, idx, arr) => {
                const prevEvent = arr[idx - 1]
                const showRoundDivider = prevEvent && prevEvent.roundNumber !== event.roundNumber
                
                return (
                  <div key={idx}>
                    {showRoundDivider && (
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 border-t-2 border-retro-gold/50" />
                        <span className="font-retro text-[10px] text-retro-gold">ROUND {prevEvent.roundNumber}</span>
                        <div className="flex-1 border-t-2 border-retro-gold/50" />
                      </div>
                    )}
                    
                    {event.type === 'challenge' && (
                      <div className={`font-mono text-xs flex items-center gap-2 py-1 px-2 mb-1 rounded ${
                        event.data.wasValid ? 'bg-retro-gold/20' : 'bg-retro-red/20'
                      }`}>
                        <span>⚡</span>
                        <span className="font-bold">
                          {getPlayerName(event.data.challengerId)}
                        </span>
                        <span>challenged</span>
                        <span className={SUIT_COLORS[event.data.card.suit]}>
                          {formatCard(event.data.card)}
                        </span>
                        <span className="ml-auto font-bold">
                          {event.data.wasValid ? 'BAD CALL' : 'CAUGHT!'} +4
                        </span>
                      </div>
                    )}
                    
                    {event.type === 'trick' && (() => {
                      const trick = event.data
                      const trickEvents = eventLog.filter(e => e.type === 'trick')
                      const trickNum = trickEvents.length - trickEvents.slice().reverse().findIndex(e => e === event)
                      const winningCard = getWinningCard(trick)
                      const points = getTrickPointsFromData(trick)
                      const reason = getWinReason(trick)
                      
                      return (
                        <div className="font-mono text-xs flex items-center gap-2 border-b border-gray-200 pb-1">
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
                            {getPlayerName(trick.winnerId)}
                          </span>
                          {winningCard && (
                            <span className={SUIT_COLORS[winningCard.suit]}>
                              {formatCard(winningCard)}{reason === 'trump' && '🎺'}
                            </span>
                          )}
                          <span className="text-gray-600 ml-auto">+{points}</span>
                        </div>
                      )
                    })()}
                    
                    {event.type === 'thunee-call' && (
                      <div className="font-mono text-xs flex items-center gap-2 py-1 px-2 mb-1 rounded bg-retro-gold/30">
                        <span>🎯</span>
                        <span className="font-bold">{getPlayerName(event.data.playerId)}</span>
                        <span>called THUNEE!</span>
                      </div>
                    )}
                    
                    {event.type === 'jodhi-call' && (
                      <div className="font-mono text-xs flex items-center gap-2 py-1 px-2 mb-1 rounded bg-purple-200">
                        <span>👑</span>
                        <span className="font-bold">{getPlayerName(event.data.playerId)}</span>
                        <span>Jodhi</span>
                        <span className={SUIT_COLORS[event.data.suit]}>
                          {SUIT_SYMBOLS[event.data.suit]}
                        </span>
                        <span className="ml-auto">+{event.data.points}</span>
                      </div>
                    )}
                    
                    {event.type === 'khanaak-call' && (
                      <div className={`font-mono text-xs flex items-center gap-2 py-1 px-2 mb-1 rounded ${
                        event.data.success ? 'bg-purple-300' : 'bg-retro-red/20'
                      }`}>
                        <span>🎯</span>
                        <span className="font-bold">{getPlayerName(event.data.playerId)}</span>
                        <span>{event.data.isBackward ? 'Backward ' : ''}Khanaak</span>
                        <span className="ml-auto font-bold">
                          {event.data.success 
                            ? `+${event.data.isBackward ? 6 : 3}` 
                            : 'FAILED! +4'}
                        </span>
                      </div>
                    )}
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
