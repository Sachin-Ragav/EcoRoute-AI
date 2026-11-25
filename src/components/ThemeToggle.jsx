import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const toggle = () => {
    const nextDark = !dark
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light'
    localStorage.setItem('ecoroute-theme', nextDark ? 'dark' : 'light')
    setDark(nextDark)
  }
  return <button type="button" className="theme-toggle" onClick={toggle} title={`Switch to ${dark ? 'light' : 'dark'} mode`} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
}

export default ThemeToggle
