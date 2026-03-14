import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

// Fallback data in case API is unreachable
const FALLBACK = [
  { question: 'US tariff rate on China above 25%?', yes_price: 0.72 },
  { question: 'Fed cuts rates before July 2026?', yes_price: 0.41 },
  { question: 'Will Trump visit China by June?', yes_price: 0.34 },
  { question: 'Iran closes Strait of Hormuz before 2027?', yes_price: 0.19 },
  { question: 'US recession in 2026?', yes_price: 0.28 },
  { question: 'Oil above $120/barrel by December?', yes_price: 0.15 },
  { question: 'Court forces tariff refund?', yes_price: 0.32 },
  { question: '100% tariff on Canada by June 30?', yes_price: 0.08 },
  { question: 'Bitcoin above $150k by 2026?', yes_price: 0.22 },
  { question: 'Israel-Iran ceasefire holds through June?', yes_price: 0.51 },
  { question: 'EU retaliatory tariffs by Q3?', yes_price: 0.44 },
  { question: 'US government shutdown in 2026?', yes_price: 0.37 },
]

function PriceChange({ price }) {
  const pct = Math.round(price * 100)
  const color = pct >= 50 ? 'var(--green)' : 'var(--red)'
  return (
    <span style={{ fontFamily: 'var(--font-mono)', color, fontWeight: 500, fontSize: '11px' }}>
      {pct}%
    </span>
  )
}

export default function LiveTicker() {
  const [markets, setMarkets] = useState(FALLBACK)

  useEffect(() => {
    let cancelled = false

    async function fetchTicker() {
      try {
        const resp = await fetch(`${API_URL}/api/markets/ticker-feed`)
        if (!resp.ok) throw new Error('Failed')
        const data = await resp.json()
        if (!cancelled && data.length > 0) {
          setMarkets(data)
        }
      } catch {
        // keep fallback data
      }
    }

    fetchTicker()
    const interval = setInterval(fetchTicker, 60000) // refresh every 60s
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const doubled = [...markets, ...markets]

  return (
    <div className="ticker-wrap">
      <div className="ticker-label">LIVE</div>
      <div className="ticker-track">
        {doubled.map((m, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-dot" />
            <span className="name">{m.question}</span>
            <PriceChange price={m.yes_price} />
          </span>
        ))}
      </div>
    </div>
  )
}
