import { Shield } from 'lucide-react'

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-mark">
          <Shield size={14} strokeWidth={2.5} />
        </div>
        <span className="logo-wordmark">Trygg</span>
      </div>
      <div className="header-right">
        <span className="header-tagline">Prediction Market Hedging</span>
      </div>
    </header>
  )
}
