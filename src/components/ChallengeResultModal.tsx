import { useEffect } from 'react'
import type { Card as CardType, Player } from '@/game/types'
import { Card } from './Card'

interface ChallengeResultModalProps {
  challengerId: string
  accusedId: string
  card: CardType
  wasValid: boolean
  winningTeam: 0 | 1
  players: Player[]
  onDismiss: () => void
}

export function ChallengeResultModal({
  accusedId,
  card,
  wasValid,
  winningTeam,
  players,
  onDismiss,
}: ChallengeResultModalProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const accused = players.find(p => p.id === accusedId)
  const winningPlayers = players.filter(p => p.team === winningTeam).map(p => p.name)

  return (
    <div
      className="fixed inset-0 bg-retro-black/80 flex items-center justify-center z-50"
      onClick={onDismiss}
    >
      <div className="card-container p-6 text-center space-y-4 animate-pulse">
        <h2 className="font-retro text-2xl text-retro-gold">CHALLENGE!</h2>
        
        <div className="flex justify-center">
          <Card card={card} />
        </div>
        
        <p className="font-mono text-sm text-retro-black/70">
          {accused?.name}'s play
        </p>
        
        <p className={`font-retro text-xl ${wasValid ? 'text-retro-gold' : 'text-retro-red'}`}>
          {wasValid ? 'BAD CHALLENGE!' : 'CHEATER CAUGHT!'}
        </p>
        
        <p className="font-mono text-sm text-retro-black">
          {winningPlayers.join(' & ')} +4 balls
        </p>
        
        <p className="font-mono text-xs text-retro-black/50">
          Tap to continue
        </p>
      </div>
    </div>
  )
}
