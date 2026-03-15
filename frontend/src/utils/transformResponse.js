/**
 * Transforms backend API response into the shape the frontend expects.
 *
 * Backend returns a flat array of contracts:
 *   [{ title, source, ticker, url, side, current_price, payout_ratio, end_date, correlation, reasoning, confidence }]
 *
 * Frontend expects:
 *   { positions[], risks[], total_cost, total_max_profit, total_exposure, budget_rationale, warnings[], unhedgeable_risks[] }
 */

const DEFAULT_ALLOCATION_PER_POSITION = 2000

function parsePayoutRatio(raw) {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const n = parseFloat(raw.replace('x', ''))
    return isNaN(n) ? 0 : n
  }
  return 0
}

function formatDate(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function generateWarnings(positions) {
  const warnings = []
  const now = new Date()

  for (const p of positions) {
    if (!p.end_date) continue
    const end = new Date(p.end_date)
    const daysUntil = Math.round((end - now) / (1000 * 60 * 60 * 24))
    if (daysUntil > 0 && daysUntil < 30) {
      warnings.push(
        `${p.contract_title} expires in ${daysUntil} days — short duration may not match ongoing business risk.`
      )
    }
  }

  return warnings
}

function mapContract(contract, allocation) {
  return {
    contract_title: contract.title || contract.contract_title,
    contract_source: contract.source || contract.contract_source || 'Polymarket',
    side: contract.side,
    current_price: contract.current_price,
    allocation,
    url: contract.url || '',
    reasoning: contract.reasoning || '',
    ticker: contract.ticker || null,
    end_date: contract.end_date || null,
    end_date_formatted: formatDate(contract.end_date),
    correlation: contract.correlation || null,
    confidence: contract.confidence || 0,
    payout_ratio_raw: contract.payout_ratio || null,
    risk: {
      event: contract.risk?.event || contract.title || contract.contract_title || 'Identified risk',
    },
  }
}

export function transformResponse(data) {
  // New format: quant engine returns { positions, portfolio_metrics, simulation }
  if (data && !Array.isArray(data) && data.positions && data.portfolio_metrics) {
    const metrics = data.portfolio_metrics
    const sim = data.simulation || {}

    const positions = data.positions.map((p) => ({
      ...mapContract(p, p.allocation || 0),
      kelly_fraction: p.kelly_fraction,
      expected_value: p.expected_value,
      portfolio_weight_pct: p.portfolio_weight_pct,
      shares: p.shares,
      max_payout: p.max_payout,
      return_multiple: p.return_multiple,
    }))

    const warnings = generateWarnings(positions)

    return {
      positions,
      risks: [],
      total_cost: metrics.total_cost || 0,
      total_max_profit: metrics.max_payout || 0,
      total_exposure: 0,
      expected_value: metrics.expected_value || 0,
      coverage_ratio: metrics.coverage_ratio || 0,
      diversification_score: metrics.diversification_score || 0,
      budget_utilization: metrics.budget_utilization || 0,
      simulation: {
        p10: sim.p10 || 0,
        p25: sim.p25 || 0,
        p50: sim.p50 || 0,
        p75: sim.p75 || 0,
        p90: sim.p90 || 0,
        mean: sim.mean || 0,
        prob_profit: sim.prob_profit || 0,
        expected_payout: sim.expected_payout || 0,
        histogram: sim.histogram || [],
      },
      budget_rationale: `Kelly + mean-variance optimized across ${positions.length} positions. $${(metrics.total_cost || 0).toLocaleString()} premium → $${(metrics.max_payout || 0).toLocaleString()} max protection (${(metrics.coverage_ratio || 0).toFixed(1)}x). Monte Carlo: ${(sim.prob_profit || 0)}% chance of profit, median outcome $${(sim.p50 || 0).toLocaleString()}.`,
      warnings,
      unhedgeable_risks: [],
    }
  }

  // Legacy format: already has positions object
  if (data && !Array.isArray(data) && data.positions) {
    const positions = data.positions.map((p) => ({
      ...p,
      contract_title: p.contract_title || p.title,
      contract_source: p.contract_source || p.source || 'Polymarket',
      end_date_formatted: formatDate(p.end_date),
    }))
    return { ...data, positions }
  }

  // Fallback: flat array of contracts (no quant engine)
  const contracts = Array.isArray(data) ? data : []
  if (contracts.length === 0) {
    return {
      positions: [],
      risks: [],
      total_cost: 0,
      total_max_profit: 0,
      total_exposure: 0,
      budget_rationale: '',
      warnings: [],
      unhedgeable_risks: [],
    }
  }

  const totalConfidence = contracts.reduce((s, c) => s + (c.confidence || 0.5), 0)
  const baseBudget = contracts.length * DEFAULT_ALLOCATION_PER_POSITION

  const positions = contracts.map((c) => {
    const weight = (c.confidence || 0.5) / totalConfidence
    const allocation = Math.round(baseBudget * weight)
    return mapContract(c, allocation)
  })

  const totalCost = positions.reduce((s, p) => s + p.allocation, 0)
  const totalMaxProfit = positions.reduce((s, p) => {
    const price = p.current_price || 0.5
    return s + (price > 0 ? Math.round(p.allocation / price) : 0)
  }, 0)

  const avgPayout = totalCost > 0 ? (totalMaxProfit / totalCost).toFixed(1) : '0'
  const warnings = generateWarnings(positions)

  return {
    positions,
    risks: [],
    total_cost: totalCost,
    total_max_profit: totalMaxProfit,
    total_exposure: 0,
    budget_rationale: `Recommended allocating $${totalCost.toLocaleString()} across ${positions.length} positions for up to $${totalMaxProfit.toLocaleString()} in max protection (${avgPayout}x average coverage ratio).`,
    warnings,
    unhedgeable_risks: [],
  }
}
