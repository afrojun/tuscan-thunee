import type { TeamScore, Player } from '@/game/types'

interface ScoreBoardProps {
  teams: [TeamScore, TeamScore]
  players: Player[]
  currentBid: number
}

export function ScoreBoard({ teams, players, currentBid }: ScoreBoardProps) {
  const team0Players = players.filter(p => p.team === 0).map(p => p.name).join(' & ')
  const team1Players = players.filter(p => p.team === 1).map(p => p.name).join(' & ')

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
        </div>
      </div>

      {currentBid > 0 && (
        <div className="mt-2 pt-2 border-t border-retro-black/30 text-center font-mono text-sm sm:text-base text-gray-600">
          Current call: <span className="font-bold">{currentBid}</span>
        </div>
      )}
    </div>
  )
}
