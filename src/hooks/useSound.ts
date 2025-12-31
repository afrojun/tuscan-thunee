import { useCallback, useRef } from 'react'

type SoundType = 'cardPlay' | 'cardDeal' | 'trickWin' | 'yourTurn' | 'challenge' | 'ball' | 'gameOver'

const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)() : null

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  if (!audioContext) return
  
  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
  
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
  
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + duration)
}

function playNoise(duration: number, volume = 0.2) {
  if (!audioContext) return
  
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  
  const bufferSize = audioContext.sampleRate * duration
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
  const data = buffer.getChannelData(0)
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  
  const source = audioContext.createBufferSource()
  const gainNode = audioContext.createGain()
  const filter = audioContext.createBiquadFilter()
  
  source.buffer = buffer
  filter.type = 'lowpass'
  filter.frequency.value = 1000
  
  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
  
  source.start()
}

const sounds: Record<SoundType, () => void> = {
  cardPlay: () => {
    // Quick thwack sound for playing a card
    playNoise(0.08, 0.25)
    playTone(200, 0.05, 'square', 0.1)
  },
  
  cardDeal: () => {
    // Softer dealing sound
    playNoise(0.05, 0.15)
  },
  
  trickWin: () => {
    // Ascending notes for winning a trick
    playTone(440, 0.1, 'sine', 0.2)
    setTimeout(() => playTone(554, 0.1, 'sine', 0.2), 80)
    setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 160)
  },
  
  yourTurn: () => {
    // Gentle notification
    playTone(660, 0.1, 'sine', 0.15)
    setTimeout(() => playTone(880, 0.15, 'sine', 0.2), 100)
  },
  
  challenge: () => {
    // Dramatic descending sound
    playTone(880, 0.1, 'sawtooth', 0.2)
    setTimeout(() => playTone(660, 0.1, 'sawtooth', 0.2), 100)
    setTimeout(() => playTone(440, 0.2, 'sawtooth', 0.25), 200)
  },
  
  ball: () => {
    // Celebration sound for winning a ball
    playTone(523, 0.15, 'sine', 0.25)
    setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 120)
    setTimeout(() => playTone(784, 0.15, 'sine', 0.25), 240)
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.3), 360)
  },
  
  gameOver: () => {
    // Fanfare for game over
    const notes = [523, 659, 784, 1047, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'sine', 0.25), i * 150)
    })
  },
}

export function useSound() {
  const enabledRef = useRef(true)
  
  const play = useCallback((type: SoundType) => {
    if (!enabledRef.current) return
    try {
      sounds[type]()
    } catch {
      // Ignore audio errors
    }
  }, [])
  
  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled
  }, [])
  
  return { play, setEnabled }
}

// Create a global sound player for non-hook contexts
export const globalSound = {
  play: (type: SoundType) => {
    try {
      sounds[type]()
    } catch {
      // Ignore audio errors
    }
  },
}
