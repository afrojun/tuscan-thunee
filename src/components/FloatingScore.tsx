interface FloatingScoreProps {
  points: number
  position?: 'center' | 'left' | 'right'
}

export function FloatingScore({ points, position = 'center' }: FloatingScoreProps) {
  const positionClasses = {
    center: 'left-1/2 -translate-x-1/2',
    left: 'left-1/4 -translate-x-1/2',
    right: 'right-1/4 translate-x-1/2',
  }

  return (
    <div 
      className={`absolute top-1/2 ${positionClasses[position]} pointer-events-none z-50`}
    >
      <div className="animate-float-score font-retro text-2xl sm:text-3xl text-retro-gold drop-shadow-lg">
        +{points}
      </div>
    </div>
  )
}
