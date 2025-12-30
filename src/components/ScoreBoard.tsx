import type { TeamScore, Player, GamePhase, Suit } from '@/game/types'

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
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export function ScoreBoard({ teams, players, currentBid, playerCount, dealRound, phase, jodhiCalls = [] }: ScoreBoardProps) {
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

  return (
    <div className="card-container p-3 sm:p-4">
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
    </div>
  )
}
