import { useState, useEffect, useMemo } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

function formatDate(ts) {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function PriceChart({ question, color = 'var(--green)', width = 320, height = 80 }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchHistory() {
      try {
        const resp = await fetch(
          `${API_URL}/api/markets/price-history?question=${encodeURIComponent(question)}`
        )
        if (!resp.ok) throw new Error('Failed')
        const data = await resp.json()
        if (!cancelled && data.length > 0) {
          setHistory(data)
        }
      } catch {
        // no history available
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchHistory()
    return () => { cancelled = true }
  }, [question])

  const chartData = useMemo(() => {
    if (!history || history.length < 2) return null

    const prices = history.map(p => p.p)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 0.01

    const padding = 4
    const chartW = width - padding * 2
    const chartH = height - padding * 2 - 20 // leave room for labels

    const points = history.map((point, i) => {
      const x = padding + (i / (history.length - 1)) * chartW
      const y = padding + chartH - ((point.p - min) / range) * chartH
      return { x, y, price: point.p, time: point.t }
    })

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

    // Area fill
    const areaD = pathD +
      ` L${points[points.length - 1].x},${height - 20}` +
      ` L${points[0].x},${height - 20} Z`

    const first = prices[0]
    const last = prices[prices.length - 1]
    const change = last - first
    const changePct = ((change / first) * 100).toFixed(1)

    return { points, pathD, areaD, min, max, first, last, change, changePct }
  }, [history, width, height])

  if (loading) {
    return (
      <div className="price-chart-container">
        <div className="price-chart-loading">
          <div className="price-chart-skeleton" />
          <span>Loading price history...</span>
        </div>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className="price-chart-container">
        <div className="price-chart-empty">
          No price history available
        </div>
      </div>
    )
  }

  const hovered = hoveredIndex !== null ? chartData.points[hoveredIndex] : null
  const isPositive = chartData.change >= 0
  const lineColor = isPositive ? 'var(--green)' : 'var(--red)'

  return (
    <div className="price-chart-container">
      <div className="price-chart-header">
        <div className="price-chart-current">
          <span className="price-chart-price">
            {hovered ? `${Math.round(hovered.price * 100)}%` : `${Math.round(chartData.last * 100)}%`}
          </span>
          {hovered && (
            <span className="price-chart-date">{formatDate(hovered.time)}</span>
          )}
        </div>
        <span className={`price-chart-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '+' : ''}{chartData.changePct}%
        </span>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="price-chart-svg"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id={`fill-${question.slice(0, 8)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={chartData.areaD}
          fill={`url(#fill-${question.slice(0, 8)})`}
        />

        {/* Line */}
        <path
          d={chartData.pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover targets */}
        {chartData.points.map((point, i) => (
          <rect
            key={i}
            x={point.x - (width / chartData.points.length) / 2}
            y={0}
            width={width / chartData.points.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}

        {/* Hover dot */}
        {hovered && (
          <>
            <line
              x1={hovered.x}
              y1={0}
              x2={hovered.x}
              y2={height - 20}
              stroke="var(--text-4)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={4}
              fill={lineColor}
              stroke="var(--bg-1)"
              strokeWidth="2"
            />
          </>
        )}

        {/* X-axis labels */}
        {history && history.length > 0 && (
          <>
            <text x={4} y={height - 4} fill="var(--text-4)" fontSize="9" fontFamily="var(--font-mono)">
              {formatDate(history[0].t)}
            </text>
            <text x={width - 4} y={height - 4} fill="var(--text-4)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">
              {formatDate(history[history.length - 1].t)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
