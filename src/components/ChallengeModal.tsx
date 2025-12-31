import type { Player, Suit } from '@/game/types'

interface JodhiCall {
  playerId: string
  suit: Suit
  points: number
  hasJack: boolean
}

interface ChallengeModalProps {
  opponents: Player[]
  jodhiCalls: JodhiCall[]
  onChallengePlay: (accusedId: string) => void
  onChallengeJodhi: (accusedId: string, suit: Suit) => void
  onClose: () => void
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

export function ChallengeModal({ 
  opponents, 
  jodhiCalls, 
  onChallengePlay, 
  onChallengeJodhi, 
  onClose 
}: ChallengeModalProps) {
  const getOpponentJodhis = (playerId: string) => {
    return jodhiCalls.filter(j => j.playerId === playerId)
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="card-container p-4 max-w-sm w-full space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="font-retro text-sm text-retro-black text-center">CHALLENGE</p>
        
        {opponents.length === 0 ? (
          <p className="font-mono text-sm text-gray-600 text-center">
            No opponents to challenge
          </p>
        ) : (
          <div className="space-y-4">
            {opponents.map(opponent => {
              const opponentJodhis = getOpponentJodhis(opponent.id)
              
              return (
                <div key={opponent.id} className="space-y-2">
                  <p className="font-mono text-sm font-bold text-retro-black">
                    {opponent.name}
                  </p>
                  
                  <div className="space-y-2">
                    {/* Challenge their last play */}
                    <button
                      onClick={() => onChallengePlay(opponent.id)}
                      className="btn-danger text-xs"
                    >
                      Last Play
                    </button>
                    
                    {/* Jodhi challenges - suit buttons */}
                    {opponentJodhis.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-600">Jodhi:</span>
                        {opponentJodhis.map(jodhi => (
                          <button
                            key={jodhi.suit}
                            onClick={() => onChallengeJodhi(opponent.id, jodhi.suit)}
                            className={`px-2 py-1 font-mono text-sm border-2 border-retro-black 
                              bg-retro-cream hover:bg-retro-red hover:text-white hover:border-retro-red
                              transition-colors ${SUIT_COLORS[jodhi.suit]}`}
                          >
                            <span className="text-lg">{SUIT_SYMBOLS[jodhi.suit]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        <button
          onClick={onClose}
          className="w-full text-sm text-gray-500 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
