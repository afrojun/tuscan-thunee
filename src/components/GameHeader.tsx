import { useNavigate } from 'react-router-dom'

interface GameHeaderProps {
  gameId: string
}

export function GameHeader({ gameId }: GameHeaderProps) {
  const navigate = useNavigate()

  const handleLeave = () => {
    if (confirm('Leave this game?')) {
      navigate('/')
    }
  }

  return (
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
    </div>
  )
}
