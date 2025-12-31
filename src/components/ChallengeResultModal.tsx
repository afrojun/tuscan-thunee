import { useEffect } from 'react'
import type { Card as CardType, Player, Suit } from '@/game/types'
import { Card } from './Card'

interface ChallengeResult {
  challengerId: string
  accusedId: string
  challengeType: 'play' | 'jodhi'
  card?: CardType
  suit?: Suit
  wasValid: boolean
  winningTeam: 0 | 1
}

interface ChallengeResultModalProps {
  result: ChallengeResult
  players: Player[]
  onDismiss: () => void
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

export function ChallengeResultModal({
  result,
  players,
  onDismiss,
}: ChallengeResultModalProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const accused = players.find(p => p.id === result.accusedId)
  const winningPlayers = players.filter(p => p.team === result.winningTeam).map(p => p.name)

  const isPlayChallenge = result.challengeType === 'play'
  const isJodhiChallenge = result.challengeType === 'jodhi'

  return (
    <div
      className="fixed inset-0 bg-retro-black/80 flex items-center justify-center z-50"
      onClick={onDismiss}
    >
      <div className="card-container p-6 text-center space-y-4 animate-pulse">
        <h2 className="font-retro text-2xl text-retro-gold">CHALLENGE!</h2>
        
        {/* Show the challenged item */}
        {isPlayChallenge && result.card && (
          <>
            <div className="flex justify-center">
              <Card card={result.card} />
            </div>
            <p className="font-mono text-sm text-retro-black/70">
              {accused?.name}'s play
            </p>
          </>
        )}
        
        {isJodhiChallenge && result.suit && (
          <div className="space-y-2">
            <p className={`text-4xl ${SUIT_COLORS[result.suit]}`}>
              👑 {SUIT_SYMBOLS[result.suit]}
            </p>
            <p className="font-mono text-sm text-retro-black/70">
              {accused?.name}'s Jodhi claim
            </p>
          </div>
        )}
        
        <p className={`font-retro text-xl ${result.wasValid ? 'text-retro-gold' : 'text-retro-red'}`}>
          {result.wasValid ? 'BAD CHALLENGE!' : 'CAUGHT!'}
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
