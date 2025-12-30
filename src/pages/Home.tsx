import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateGameCode } from '@/game/utils'

export function Home() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [playerCount, setPlayerCount] = useState<2 | 4>(4)

  const handleCreate = () => {
    const gameId = generateGameCode()
    navigate(`/game/${gameId}?players=${playerCount}`)
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (joinCode.length === 6) {
      navigate(`/game/${joinCode.toUpperCase()}`)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8">
      <h1 className="font-retro text-2xl md:text-4xl text-retro-gold text-center">
        THUNEE
      </h1>

      <div className="card-container p-6 w-full max-w-sm space-y-6">
        <div className="space-y-3">
          <h2 className="font-retro text-xs text-retro-black">CREATE GAME</h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => setPlayerCount(2)}
              className={`flex-1 py-2 border-2 border-retro-black font-retro text-xs transition-colors ${
                playerCount === 2 
                  ? 'bg-retro-black text-retro-cream' 
                  : 'bg-retro-cream text-retro-black'
              }`}
            >
              2P
            </button>
            <button
              onClick={() => setPlayerCount(4)}
              className={`flex-1 py-2 border-2 border-retro-black font-retro text-xs transition-colors ${
                playerCount === 4 
                  ? 'bg-retro-black text-retro-cream' 
                  : 'bg-retro-cream text-retro-black'
              }`}
            >
              4P
            </button>
          </div>

          <button onClick={handleCreate} className="btn-retro w-full">
            CREATE
          </button>
        </div>

        <div className="border-t-2 border-retro-black pt-6 space-y-3">
          <h2 className="font-retro text-xs text-retro-black">JOIN GAME</h2>
          
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ENTER CODE"
              className="w-full px-3 py-2 bg-retro-cream text-retro-black font-mono text-lg
                         border-2 border-retro-black text-center tracking-widest
                         placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-sm"
            />
            <button 
              type="submit" 
              className="btn-retro w-full"
              disabled={joinCode.length !== 6}
            >
              JOIN
            </button>
          </form>
        </div>
      </div>

      <p className="font-mono text-xs text-retro-cream/60 text-center">
        A South African card game
      </p>
    </div>
  )
}
