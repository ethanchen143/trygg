import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, ExternalLink, BarChart3, Clock } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''

function formatVolume(vol) {
  if (!vol) return '$0'
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`
  return `$${Math.round(vol)}`
}

function formatDate(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

function ProbabilityBar({ probability }) {
  const pct = Math.round(probability * 100)
  const isHigh = pct >= 50
  return (
    <div className="trending-prob-bar-wrap">
      <div className="trending-prob-bar">
        <div
          className={`trending-prob-fill ${isHigh ? 'high' : 'low'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`trending-prob-value ${isHigh ? 'high' : 'low'}`}>
        {pct}%
      </span>
    </div>
  )
}

export default function TrendingMarkets({ markets: propMarkets }) {
  const [fetchedMarkets, setFetchedMarkets] = useState([])
  const [loading, setLoading] = useState(!propMarkets?.length)
  const [expanded, setExpanded] = useState(false)

  const hasProps = propMarkets && propMarkets.length > 0

  useEffect(() => {
    if (hasProps) return // skip fetch when we have prop data

    let cancelled = false

    async function fetchTrending() {
      try {
        const resp = await fetch(`${API_URL}/api/markets/trending`)
        if (!resp.ok) throw new Error('Failed')
        const data = await resp.json()
        if (!cancelled && data.length > 0) {
          setFetchedMarkets(data)
        }
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchTrending()
    const interval = setInterval(fetchTrending, 120000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [hasProps])

  // Normalize prop markets to match the shape the component expects
  const markets = hasProps
    ? propMarkets.map((m, i) => ({
        id: m.ticker || i,
        question: m.title,
        yes_price: m.yes_price,
        volume: m.volume,
        end_date: m.end_date,
        slug: '',
        url: m.url,
        source: m.source,
      }))
    : fetchedMarkets

  if (loading || markets.length === 0) return null

  const visible = expanded ? markets : markets.slice(0, 8)

  return (
    <motion.section
      className="trending-section"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="trending-header">
        <div className="trending-header-left">
          <TrendingUp size={16} className="trending-icon" />
          <span className="trending-title">{hasProps ? 'Related Markets' : 'Live Markets'}</span>
          <span className="trending-subtitle">{hasProps ? 'Other contracts the AI considered' : 'Top by volume on Polymarket'}</span>
        </div>
        <div className="trending-live-dot" />
      </div>

      <div className="trending-grid">
        {visible.map((market, i) => (
          <motion.div
            key={market.id || i}
            className="trending-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
          >
            <div className="trending-card-question">
              {market.url ? (
                <a href={market.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  {market.question}
                </a>
              ) : market.question}
            </div>
            <ProbabilityBar probability={market.yes_price} />
            <div className="trending-card-meta">
              <span className="trending-card-vol">
                <BarChart3 size={11} />
                {formatVolume(market.volume)}
              </span>
              {market.end_date && (
                <span className="trending-card-date">
                  <Clock size={11} />
                  {formatDate(market.end_date)}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {markets.length > 8 && (
        <button className="trending-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : `Show all ${markets.length} markets`}
        </button>
      )}
    </motion.section>
  )
}
