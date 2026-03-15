import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, ChevronDown, ChevronUp, ArrowLeft, ExternalLink, TrendingUp, Shield, Clock, BarChart3, Zap, Copy, Check } from 'lucide-react'
import PortfolioSummary from './PortfolioSummary'
import QuantAnalytics from './QuantAnalytics'
import TrendingMarkets from './TrendingMarkets'
import MarketDepthBar from './MarketDepthBar'
import PriceChart from './PriceChart'

function PositionCard({ position, index, totalCost, featured }) {
  const [expanded, setExpanded] = useState(false)
  const side = position.side?.toUpperCase()
  const price = position.current_price ?? position.price
  const allocation = position.allocation || position.cost || 0
  const payout = price > 0 ? Math.round(allocation / price) : 0
  const returnMultiple = price > 0 ? ((1 / price) - 1).toFixed(1) : '—'
  const portfolioPct = totalCost > 0 ? Math.round((allocation / totalCost) * 100) : 0
  const confidence = position.confidence || 0
  const confidenceLabel = confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Med' : 'Low'
  const confidenceClass = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'med' : 'low'
  const isYes = side === 'YES'
  const noPrice = 1 - (price || 0)
  const profit = payout - allocation

  return (
    <motion.div
      className={`position-card${featured ? ' position-card--featured' : ''}${expanded ? ' position-card--expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <div className="position-card-top">
        <div className="position-card-left">
          <div className="position-card-title-row">
            <div className="position-card-title">{position.contract_title}</div>
            <span className={`confidence-badge ${confidenceClass}`}>{confidenceLabel}</span>
            <span className={`position-side-badge-inline ${isYes ? 'yes' : 'no'}`}>
              {side} {Math.round(price * 100)}%
            </span>
          </div>
          <div className="position-card-subtitle">
            <span className="position-card-alloc">${allocation.toLocaleString()}</span>
          </div>
        </div>
        <div className="position-card-right">
          <div className="position-card-glance">
            <span className="position-card-cost-label">Return</span>
            <span className="position-card-multiple">{returnMultiple}x</span>
            <span className="position-card-cost">{portfolioPct}% of premium</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="position-card-detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* AI Reasoning — hero placement */}
            {position.reasoning && (
              <div className="detail-reasoning detail-reasoning--hero">
                <div className="detail-section-label">
                  <Zap size={14} />
                  AI Reasoning
                </div>
                <p className="position-reasoning-text">
                  {position.reasoning}
                </p>
              </div>
            )}

            {/* Market Depth Visualization */}
            <div className="detail-depth-section">
              <div className="detail-section-label">Market Probability</div>
              <MarketDepthBar
                yesPrice={price}
                noPrice={noPrice}
                size="large"
              />
            </div>

            {/* Big Stats Grid */}
            <div className="detail-stats-grid">
              <div className="detail-stat-card">
                <div className="detail-stat-icon">
                  <Zap size={16} />
                </div>
                <div className="detail-stat-content">
                  <div className="detail-stat-value">${price?.toFixed(2)}</div>
                  <div className="detail-stat-label">Entry Price</div>
                </div>
              </div>
              <div className="detail-stat-card highlight">
                <div className="detail-stat-icon green">
                  <TrendingUp size={16} />
                </div>
                <div className="detail-stat-content">
                  <div className="detail-stat-value green">{returnMultiple}x</div>
                  <div className="detail-stat-label">Return Multiple</div>
                </div>
              </div>
              <div className="detail-stat-card">
                <div className="detail-stat-icon">
                  <BarChart3 size={16} />
                </div>
                <div className="detail-stat-content">
                  <div className="detail-stat-value">${allocation.toLocaleString()}</div>
                  <div className="detail-stat-label">Position Size</div>
                </div>
              </div>
              <div className="detail-stat-card highlight">
                <div className="detail-stat-icon green">
                  <Shield size={16} />
                </div>
                <div className="detail-stat-content">
                  <div className="detail-stat-value green">${payout.toLocaleString()}</div>
                  <div className="detail-stat-label">Max Payout</div>
                </div>
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="detail-payout-breakdown">
              <div className="detail-section-label">Payout Breakdown</div>
              <div className="payout-visual">
                <div className="payout-bar-wrap">
                  <div className="payout-bar-cost" style={{ width: `${totalCost > 0 ? Math.min((allocation / payout) * 100, 100) : 50}%` }}>
                    <span>Cost: ${allocation.toLocaleString()}</span>
                  </div>
                  <div className="payout-bar-profit">
                    <span>Profit: ${profit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Details */}
            <div className="detail-info-grid">
              <div className="detail-info-item">
                <span className="detail-info-label">Source</span>
                <span className="detail-info-value">
                  {position.contract_source || 'Polymarket'}
                  {position.ticker && <span className="detail-ticker">{position.ticker}</span>}
                </span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">Side</span>
                <span className="detail-info-value">
                  <span className={`position-side-badge ${isYes ? 'yes' : 'no'}`}>
                    {side}
                  </span>
                </span>
              </div>
              {position.end_date_formatted && (
                <div className="detail-info-item">
                  <span className="detail-info-label">Expires</span>
                  <span className="detail-info-value">
                    <Clock size={13} style={{ marginRight: 4, opacity: 0.5 }} />
                    {position.end_date_formatted}
                  </span>
                </div>
              )}
              {position.correlation && (
                <div className="detail-info-item">
                  <span className="detail-info-label">Correlation</span>
                  <span className="detail-info-value">
                    <span className={`correlation-badge ${position.correlation.toLowerCase()}`}>
                      {position.correlation}
                    </span>
                  </span>
                </div>
              )}
              <div className="detail-info-item">
                <span className="detail-info-label">Portfolio Weight</span>
                <span className="detail-info-value">{portfolioPct}%</span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">Hedges</span>
                <span className="detail-info-value">{position.risk?.event || '—'}</span>
              </div>
            </div>

            {/* Real Price History */}
            <div className="detail-chart-section">
              <div className="detail-section-label">Price History</div>
              <PriceChart
                question={position.contract_title}
                color={isYes ? 'var(--green)' : 'var(--red)'}
                width={560}
                height={120}
              />
            </div>

            {position.url && (
              <a
                href={position.url}
                target="_blank"
                rel="noopener noreferrer"
                className="contract-link"
                onClick={(e) => e.stopPropagation()}
              >
                View on {position.contract_source || 'Polymarket'} <ExternalLink size={12} />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand indicator */}
      <div className="position-card-expand-hint">
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
    </motion.div>
  )
}

function RiskCard({ risk }) {
  const severity = risk.confidence >= 0.8 ? 'high' : risk.confidence >= 0.5 ? 'medium' : 'low'

  return (
    <div className="risk-card">
      <div className="risk-header">
        <span className="risk-event">{risk.event}</span>
        <span className={`risk-badge ${severity}`}>{severity}</span>
      </div>
      {risk.exposure_amount && (
        <div className="risk-exposure">
          ${Number(risk.exposure_amount).toLocaleString()} exposure
        </div>
      )}
      <div className="risk-description">{risk.description}</div>
    </div>
  )
}

function buildSummaryText(data) {
  const positions = data.positions || []
  const totalCost = data.total_cost || 0
  const maxPayout = data.total_max_profit || data.max_payout || 0
  const ratio = totalCost > 0 ? (maxPayout / totalCost).toFixed(1) : '—'

  let text = `TRYGG HEDGE PORTFOLIO\n`
  text += `Coverage Ratio: ${ratio}x\n`
  text += `Premium: $${totalCost.toLocaleString()} → Max Protection: $${maxPayout.toLocaleString()}\n\n`
  text += `POSITIONS (${positions.length}):\n`

  for (const pos of positions) {
    const price = pos.current_price ?? pos.price
    const side = pos.side?.toUpperCase()
    const pct = Math.round(price * 100)
    const alloc = pos.allocation || pos.cost || 0
    const ret = price > 0 ? ((1 / price) - 1).toFixed(1) : '—'
    text += `• ${pos.contract_title}\n`
    text += `  ${side} @ ${pct}% · $${alloc.toLocaleString()} · ${ret}x return\n`
    if (pos.reasoning) text += `  → ${pos.reasoning}\n`
    text += `\n`
  }

  if (data.warnings?.length) {
    text += `WARNINGS:\n`
    for (const w of data.warnings) text += `⚠ ${w}\n`
  }

  text += `\nGenerated by Trygg — AI-powered prediction market hedging`
  return text
}

export default function Results({ data, onReset, relatedMarkets }) {
  const [showRisks, setShowRisks] = useState(false)
  const [copied, setCopied] = useState(false)
  const positions = data.positions || []
  const totalCost = data.total_cost || 0
  const risks = data.risks || []
  const warnings = data.warnings || []
  const unhedgeable = data.unhedgeable_risks || []

  const hasNotes = warnings.length > 0 || unhedgeable.length > 0
  const hasRisks = risks.length > 0
  const risksLabel = hasRisks
    ? (hasNotes ? `View ${risks.length} risks & notes` : `View ${risks.length} identified risks`)
    : (hasNotes ? `View ${warnings.length + unhedgeable.length} notes` : null)

  const handleCopy = async (e) => {
    e.stopPropagation()
    const text = buildSummaryText(data)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      className="results"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Analysis Complete Banner */}
      <motion.div
        className="results-complete-banner"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="results-complete-left">
          <Check size={16} />
          <span>Analysis complete</span>
        </div>
        <button className="results-copy-btn" onClick={handleCopy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy summary'}
        </button>
      </motion.div>

      <PortfolioSummary data={data} />

      {positions.length > 0 && (
        <section className="positions-section">
          <div className="section-header">
            Recommended Positions <span className="section-count">{positions.length}</span>
          </div>
          <div className="position-cards">
            {positions.map((pos, i) => (
              <PositionCard
                key={i}
                position={pos}
                index={i}
                totalCost={totalCost}
                featured={i === 0}
              />
            ))}
          </div>
        </section>
      )}

      {risksLabel && (
        <section className="risks-section">
          <button className="risks-toggle" onClick={() => setShowRisks(!showRisks)}>
            {showRisks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {risksLabel}
          </button>
          {showRisks && (
            <>
              <div className="risks-grid">
                {risks.map((risk, i) => (
                  <RiskCard key={i} risk={risk} />
                ))}
              </div>
              {hasNotes && (
                <div className="risks-notes">
                  {warnings.map((w, i) => (
                    <div key={`w-${i}`} className="note-item">
                      <AlertTriangle size={13} className="note-icon amber" />
                      <span className="note-text">{w}</span>
                    </div>
                  ))}
                  {unhedgeable.map((u, i) => (
                    <div key={`u-${i}`} className="note-item">
                      <Info size={13} className="note-icon red" />
                      <span className="note-text">
                        {typeof u === 'string' ? u : (
                          <><strong>{u.event}</strong> — {u.reason}</>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Quant Analytics Panel */}
      <QuantAnalytics data={data} />

      {/* Related Markets the agent considered */}
      <TrendingMarkets markets={relatedMarkets} />

      <div className="reset-bar">
        <button className="reset-btn" onClick={onReset}>
          <ArrowLeft size={13} />
          New analysis
        </button>
      </div>
    </motion.div>
  )
}
