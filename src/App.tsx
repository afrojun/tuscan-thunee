import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Game } from './pages/Game'

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:gameId" element={<Game />} />
      </Routes>
    </div>
  )
}
