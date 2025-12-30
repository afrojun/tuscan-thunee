import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface GameHeaderProps {
  gameId: string
}

export function GameHeader({ gameId }: GameHeaderProps) {
  const navigate = useNavigate()
  const [showHelp, setShowHelp] = useState(false)

  const handleLeave = () => {
    if (confirm('Leave this game?')) {
      navigate('/')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1 bg-felt-dark/50">
        <button
          onClick={handleLeave}
          className="font-mono text-xs text-retro-cream/70 hover:text-retro-cream"
        >
          ← Leave
        </button>
        <span className="font-mono text-xs text-retro-cream/50">
          {gameId}
        </span>
        <button
          onClick={() => setShowHelp(true)}
          className="font-mono text-xs text-retro-cream/70 hover:text-retro-cream"
        >
          Help ?
        </button>
      </div>

      {showHelp && (
        <div 
          className="fixed inset-0 bg-retro-black/80 flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div className="card-container p-4 max-w-xs" onClick={e => e.stopPropagation()}>
            <h2 className="font-retro text-sm text-retro-black text-center mb-3">CARD VALUES</h2>
            
            <div className="space-y-1 font-mono text-sm text-retro-black">
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-bold">Jack (J)</span>
                <span>30 pts</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-bold">Nine (9)</span>
                <span>20 pts</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-bold">Ace (A)</span>
                <span>11 pts</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-bold">Ten (10)</span>
                <span>10 pts</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-bold">King (K)</span>
                <span>3 pts</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Queen (Q)</span>
                <span>2 pts</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-retro-black/30 space-y-2 text-xs text-gray-600">
              <p><strong>Total:</strong> 152 pts per round</p>
              <p><strong>Win:</strong> First to 13 balls</p>
              <p><strong>Last trick:</strong> +10 pts bonus</p>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="btn-retro w-full mt-4 text-xs"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </>
  )
}
