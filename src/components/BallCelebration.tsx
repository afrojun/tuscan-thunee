import { useEffect, useState, useMemo } from 'react'

interface BallCelebrationProps {
  teamName: string
  ballsWon: number
  onComplete?: () => void
}

const CONFETTI_COLORS = ['#d4a847', '#f5f0e6', '#dc2626', '#22c55e', '#3b82f6', '#f59e0b']

export function BallCelebration({ teamName, ballsWon, onComplete }: BallCelebrationProps) {
  const [show, setShow] = useState(true)

  // Generate confetti pieces once on mount
  const confettiPieces = useMemo(() => 
    [...Array(20)].map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    }))
  , [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false)
      onComplete?.()
    }, 2500)
    return () => clearTimeout(timer)
  }, [onComplete])

  if (!show) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Confetti */}
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: '-20px',
            width: piece.size,
            height: piece.size * 1.5,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
      
      {/* Celebration content */}
      <div className="relative flex flex-col items-center gap-3">
        {/* Burst particles */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 animate-ball-burst"
              style={{
                transform: `rotate(${i * 30}deg) translateY(-80px)`,
                animationDelay: `${i * 0.03}s`,
              }}
            >
              <div className="w-full h-full bg-retro-gold rounded-full" />
            </div>
          ))}
        </div>
        
        {/* Ball count */}
        <div className="animate-ball-celebrate">
          <div className="font-retro text-7xl sm:text-9xl text-retro-gold drop-shadow-[0_0_30px_rgba(212,168,71,1)]">
            +{ballsWon}
          </div>
        </div>
        
        {/* BALL text */}
        <div className="font-retro text-lg sm:text-xl text-retro-gold tracking-widest">
          {ballsWon === 1 ? 'BALL' : 'BALLS'}
        </div>
        
        {/* Team name */}
        <div className="font-mono text-sm text-retro-cream/80 text-center max-w-xs mt-2">
          {teamName}
        </div>
      </div>
    </div>
  )
}
