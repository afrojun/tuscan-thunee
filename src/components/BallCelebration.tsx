import { useEffect, useState } from 'react'

interface BallCelebrationProps {
  teamName: string
  ballsWon: number
  onComplete?: () => void
}

export function BallCelebration({ teamName, ballsWon, onComplete }: BallCelebrationProps) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false)
      onComplete?.()
    }, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  if (!show) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/40 animate-pulse" />
      
      {/* Celebration content */}
      <div className="relative flex flex-col items-center gap-4">
        {/* Burst particles */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-4 h-4 animate-ball-burst"
              style={{
                transform: `rotate(${i * 45}deg) translateY(-60px)`,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div className="w-full h-full bg-retro-gold rounded-full" />
            </div>
          ))}
        </div>
        
        {/* Ball count */}
        <div className="animate-ball-celebrate">
          <div className="font-retro text-6xl sm:text-8xl text-retro-gold drop-shadow-[0_0_20px_rgba(212,168,71,0.8)]">
            +{ballsWon}
          </div>
        </div>
        
        {/* Team name */}
        <div className="font-retro text-xl sm:text-2xl text-retro-cream animate-pulse">
          {teamName}
        </div>
        
        {/* Ball icon */}
        <div className="text-4xl animate-bounce">
          🏆
        </div>
      </div>
    </div>
  )
}
