import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Activity, PieChart, TrendingUp, Calculator, BarChart3, Target, Percent, DollarSign } from 'lucide-react'

function Histogram({ histogram }) {
  if (!histogram || histogram.length === 0) return null
  const maxCount = Math.max(...histogram.map(b => b.count))

  return (
    <div className="qa-histogram-wrap">
      <div className="qa-histogram">
        {histogram.map((bucket, i) => {
          const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0
          const isProfit = bucket.min >= 0
          return (
            <div key={i} className="qa-bar-col" title={`$${bucket.min.toLocaleString()} to $${bucket.max.toLocaleString()}: ${bucket.pct}%`}>
              <div
                className={`qa-bar ${isProfit ? 'qa-bar--green' : 'qa-bar--red'}`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              {i === 0 && <span className="qa-bar-label">${bucket.min.toLocaleString()}</span>}
              {bucket.min <= 0 && bucket.max >= 0 && <span className="qa-bar-label">$0</span>}
              {i === histogram.length - 1 && <span className="qa-bar-label">${bucket.max.toLocaleString()}</span>}
            </div>
          )
        })}
      </div>
      <div className="qa-histogram-axis">
        <span>← Loss</span>
        <span>Profit →</span>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sub, className }) {
  return (
    <div className={`qa-metric ${className || ''}`}>
      <div className="qa-metric-icon"><Icon size={16} /></div>
      <div className="qa-metric-body">
        <div className="qa-metric-value">{value}</div>
        <div className="qa-metric-label">{label}</div>
        {sub && <div className="qa-metric-sub">{sub}</div>}
      </div>
    </div>
  )
}

function PositionTable({ positions }) {
  return (
    <div className="qa-table-wrap">
      <table className="qa-table">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Side</th>
            <th>Price</th>
            <th>Allocation</th>
            <th>Weight</th>
            <th>Kelly f*</th>
            <th>Shares</th>
            <th>Max Payout</th>
            <th>Expected Value</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => {
            const price = p.current_price ?? 0
            const ev = p.expected_value ?? 0
            return (
              <tr key={i}>
                <td className="qa-table-name">
                  <span className="qa-table-title">{p.contract_title}</span>
                  <span className="qa-table-source">{p.contract_source}</span>
                </td>
                <td>
                  <span className={`qa-side ${p.side?.toUpperCase() === 'YES' ? 'qa-side--yes' : 'qa-side--no'}`}>
                    {p.side?.toUpperCase()}
                  </span>
                </td>
                <td className="qa-table-mono">${price.toFixed(2)}</td>
                <td className="qa-table-mono">${(p.allocation || 0).toLocaleString()}</td>
                <td className="qa-table-mono">{p.portfolio_weight_pct || 0}%</td>
                <td className="qa-table-mono">{(p.kelly_fraction || 0).toFixed(3)}</td>
                <td className="qa-table-mono">{Math.round(p.shares || 0).toLocaleString()}</td>
                <td className="qa-table-mono">${(p.max_payout || 0).toLocaleString()}</td>
                <td className={`qa-table-mono ${ev >= 0 ? 'qa-ev-pos' : 'qa-ev-neg'}`}>
                  ${ev.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function QuantAnalytics({ data, budget, onBudgetChange }) {
  const [open, setOpen] = useState(false)
  const positions = data.positions || []
  const sim = data.simulation || {}
  const totalCost = data.total_cost || 0
  const maxPayout = data.total_max_profit || 0
  const ev = data.expected_value ?? 0
  const diversification = data.diversification_score ?? 0
  const coverageRatio = data.coverage_ratio ?? (totalCost > 0 ? maxPayout / totalCost : 0)
  const presets = [5000, 10000, 25000, 50000]
  const [localBudget, setLocalBudget] = useState(budget)
  const debounceRef = useRef(null)

  const handleBudgetInput = useCallback((val) => {
    setLocalBudget(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val >= 100) onBudgetChange(val)
    }, 500)
  }, [onBudgetChange])

  const handlePreset = useCallback((val) => {
    setLocalBudget(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onBudgetChange(val)
  }, [onBudgetChange])

  if (positions.length === 0) return null

  return (
    <motion.div
      className="qa-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <button className="qa-toggle" onClick={() => setOpen(!open)}>
        <div className="qa-toggle-left">
          <Activity size={16} />
          <span className="qa-toggle-title">Quantitative Analytics</span>
          <span className="qa-toggle-badge">Kelly · Mean-Variance · Monte Carlo</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <motion.div
          className="qa-content"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Budget adjuster */}
          <div className="qa-budget-section">
            <div className="qa-budget-row">
              <DollarSign size={16} className="qa-budget-icon" />
              <div className="qa-budget-input-wrap">
                <span className="qa-budget-prefix">$</span>
                <input
                  type="number"
                  className="qa-budget-input"
                  value={localBudget}
                  min={100}
                  step={1000}
                  onChange={(e) => handleBudgetInput(Number(e.target.value) || 0)}
                />
              </div>
              <div className="qa-budget-presets">
                {presets.map((val) => (
                  <button
                    key={val}
                    className={`qa-budget-preset${localBudget === val ? ' qa-budget-preset--active' : ''}`}
                    onClick={() => handlePreset(val)}
                  >
                    ${val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
              </div>
            </div>
            <div className="qa-budget-label">Total Premium — Capital at risk</div>
          </div>

          {/* Top metrics row */}
          <div className="qa-metrics-grid">
            <MetricCard
              icon={Target}
              label="Max Protection"
              value={`$${maxPayout.toLocaleString()}`}
              sub={`${coverageRatio.toFixed(1)}x coverage`}
              className="qa-metric--highlight"
            />
            <MetricCard
              icon={TrendingUp}
              label="Expected Value"
              value={`$${ev.toLocaleString()}`}
              sub="Probability-weighted"
              className={ev >= 0 ? 'qa-metric--green' : 'qa-metric--red'}
            />
            <MetricCard
              icon={PieChart}
              label="Diversification"
              value={`${Math.round(diversification * 100)}%`}
              sub="Herfindahl-based"
            />
            <MetricCard
              icon={Percent}
              label="Profit Probability"
              value={`${sim.prob_profit || 0}%`}
              sub="From 10k simulations"
              className="qa-metric--highlight"
            />
            <MetricCard
              icon={Calculator}
              label="Expected Payout"
              value={`$${(sim.expected_payout || 0).toLocaleString()}`}
              sub="Mean simulation outcome"
            />
          </div>

          {/* Monte Carlo section */}
          <div className="qa-section">
            <div className="qa-section-header">
              <BarChart3 size={15} />
              <span>Monte Carlo Simulation — 10,000 Outcomes</span>
            </div>

            <Histogram histogram={sim.histogram} />

            <div className="qa-percentiles">
              <div className="qa-pctl">
                <span className="qa-pctl-label">Worst Case (P10)</span>
                <span className="qa-pctl-value qa-pctl--loss">${(sim.p10 || 0).toLocaleString()}</span>
              </div>
              <div className="qa-pctl">
                <span className="qa-pctl-label">Lower Quartile (P25)</span>
                <span className="qa-pctl-value qa-pctl--loss">${(sim.p25 || 0).toLocaleString()}</span>
              </div>
              <div className="qa-pctl">
                <span className="qa-pctl-label">Median (P50)</span>
                <span className="qa-pctl-value">${(sim.p50 || 0).toLocaleString()}</span>
              </div>
              <div className="qa-pctl">
                <span className="qa-pctl-label">Upper Quartile (P75)</span>
                <span className="qa-pctl-value qa-pctl--profit">${(sim.p75 || 0).toLocaleString()}</span>
              </div>
              <div className="qa-pctl">
                <span className="qa-pctl-label">Best Case (P90)</span>
                <span className="qa-pctl-value qa-pctl--profit">${(sim.p90 || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Position breakdown table */}
          <div className="qa-section">
            <div className="qa-section-header">
              <Calculator size={15} />
              <span>Position-Level Optimization</span>
            </div>
            <PositionTable positions={positions} />
          </div>

          <div className="qa-footer">
            Portfolio optimized using Kelly Criterion for position sizing, Markowitz mean-variance optimization for allocation, and Monte Carlo simulation (n=10,000) for outcome distribution. Correlation matrix estimated from LLM risk assessments.
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
