import { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Globe, CheckCircle2, Brain, Radar, BarChart3, Shield, Building2, ChevronRight, ExternalLink } from 'lucide-react'

function EventIcon({ event }) {
  if (event.type === 'tool_call') {
    if (event.tool === 'web_search') return <Globe size={15} />
    if (event.tool === 'enrich_company') return <Building2 size={15} />
    return <Search size={15} />
  }
  if (event.type === 'tool_result') return <CheckCircle2 size={15} />
  return <Brain size={15} />
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatVolume(v) {
  if (!v) return '-'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function formatPrice(p) {
  if (p == null) return '-'
  return `${Math.round(p * 100)}¢`
}

const PHASES = [
  { key: 'identify', label: 'Identifying Risks', icon: Brain, desc: 'Analyzing your business exposure' },
  { key: 'scan', label: 'Scanning Markets', icon: Radar, desc: 'Searching 6,000+ contracts' },
  { key: 'construct', label: 'Building Portfolio', icon: BarChart3, desc: 'Optimizing hedge positions' },
]

function inferPhase(events) {
  const count = events.length
  if (count === 0) return 0
  const hasResults = events.some(e => e.type === 'tool_result')
  const toolCalls = events.filter(e => e.type === 'tool_call').length
  if (toolCalls >= 4 && hasResults) return 2
  if (toolCalls >= 1) return 1
  return 0
}

function ContractRow({ contract }) {
  const impliedProb = contract.yes_price != null ? Math.round(contract.yes_price * 100) : null

  return (
    <a
      className="contract-row"
      href={contract.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => { if (!contract.url) e.preventDefault() }}
    >
      <div className="contract-row-main">
        <span className="contract-row-title">{contract.title}</span>
        <div className="contract-row-meta">
          <span className="contract-row-source">{contract.source}</span>
          {contract.end_date && <span className="contract-row-date">{contract.end_date}</span>}
        </div>
      </div>
      <div className="contract-row-stats">
        {impliedProb != null && (
          <div className="contract-row-stat">
            <span className="contract-row-stat-value">{impliedProb}%</span>
            <span className="contract-row-stat-label">YES</span>
          </div>
        )}
        {contract.no_price != null && (
          <div className="contract-row-stat">
            <span className="contract-row-stat-value">{Math.round(contract.no_price * 100)}%</span>
            <span className="contract-row-stat-label">NO</span>
          </div>
        )}
        <div className="contract-row-stat">
          <span className="contract-row-stat-value">{formatVolume(contract.volume)}</span>
          <span className="contract-row-stat-label">Vol</span>
        </div>
      </div>
      {contract.url && <ExternalLink size={12} className="contract-row-link" />}
    </a>
  )
}

function EnrichmentDetail({ data }) {
  if (!data) return null
  return (
    <div className="detail-panel-content">
      {data.company_name && <div className="detail-kv"><span className="detail-k">Company</span><span className="detail-v">{data.company_name}</span></div>}
      {data.linkedin_industries?.length > 0 && <div className="detail-kv"><span className="detail-k">Industry</span><span className="detail-v">{data.linkedin_industries.join(', ')}</span></div>}
      {data.short_description && <div className="detail-kv"><span className="detail-k">Description</span><span className="detail-v">{data.short_description}</span></div>}
      {data.employee_count && <div className="detail-kv"><span className="detail-k">Employees</span><span className="detail-v">{data.employee_count.toLocaleString()}</span></div>}
      {data.founded_year && <div className="detail-kv"><span className="detail-k">Founded</span><span className="detail-v">{data.founded_year}</span></div>}
      {data.headquarters && <div className="detail-kv"><span className="detail-k">HQ</span><span className="detail-v">{typeof data.headquarters === 'object' ? `${data.headquarters.city || ''}, ${data.headquarters.country || ''}` : data.headquarters}</span></div>}
    </div>
  )
}

function WebResultsDetail({ text }) {
  if (!text) return null
  return (
    <div className="detail-panel-content detail-panel-content--web">
      <pre className="web-results-text">{text}</pre>
    </div>
  )
}

function FeedEvent({ event, index }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = event.type === 'tool_result' && (event.contracts?.length > 0 || event.enrichment || event.web_results)
  const isClickable = hasDetails

  return (
    <motion.div
      key={index}
      className={`feed-event-wrapper`}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`feed-event feed-event--${event.type}${isClickable ? ' feed-event--clickable' : ''}${expanded ? ' feed-event--expanded' : ''}`}
        onClick={isClickable ? () => setExpanded(e => !e) : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v) } } : undefined}
      >
        <div className="feed-event-icon">
          <EventIcon event={event} />
        </div>
        <span className="feed-event-text">
          {event.message || event.summary}
        </span>
        {event.type === 'tool_call' && (
          <div className="feed-event-spinner" />
        )}
        {event.type === 'tool_result' && !isClickable && (
          <span className="feed-event-done">Done</span>
        )}
        {isClickable && (
          <ChevronRight
            size={14}
            className={`feed-event-chevron${expanded ? ' feed-event-chevron--open' : ''}`}
          />
        )}
      </div>

      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            className="detail-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {event.contracts?.length > 0 && (
              <div className="detail-panel-contracts">
                <div className="detail-panel-header">
                  <span>{event.contracts.length} contracts found</span>
                </div>
                {event.contracts.map((c, ci) => (
                  <ContractRow key={ci} contract={c} />
                ))}
              </div>
            )}
            {event.enrichment && <EnrichmentDetail data={event.enrichment} />}
            {event.web_results && <WebResultsDetail text={event.web_results} />}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function LoadingState({ events }) {
  const bottomRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  const phase = useMemo(() => inferPhase(events), [events])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      className="loading-container"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="loading-hero">
        <div className="loading-hero-icon">
          <Shield size={20} />
          <div className="loading-hero-pulse" />
        </div>
        <div className="loading-hero-text">
          <span className="loading-title">Analyzing risk landscape</span>
          <span className="loading-elapsed">{formatElapsed(elapsed)}</span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="loading-steps">
        {PHASES.map((p, i) => {
          const Icon = p.icon
          const state = i < phase ? 'done' : i === phase ? 'active' : 'pending'
          return (
            <div key={p.key} className={`loading-step loading-step--${state}`}>
              <div className="loading-step-indicator">
                {state === 'done' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <div className={`loading-step-number ${state === 'active' ? 'loading-step-number--active' : ''}`}>
                    {i + 1}
                  </div>
                )}
              </div>
              <div className="loading-step-content">
                <span className="loading-step-label">{p.label}</span>
                <span className="loading-step-desc">{p.desc}</span>
              </div>
              {state === 'active' && <div className="loading-step-spinner" />}
            </div>
          )
        })}
      </div>

      {/* Activity Feed */}
      <div className="loading-feed">
        <div className="loading-feed-header">
          <span className="loading-feed-title">Agent Activity</span>
          <span className="loading-feed-count">{events.length} events</span>
        </div>
        <div className="loading-feed-list">
          {events.length === 0 && (
            <div className="feed-event feed-event--status">
              <Brain size={15} />
              <span>Initializing analysis...</span>
            </div>
          )}
          {events.map((event, i) => (
            <FeedEvent key={i} event={event} index={i} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </motion.div>
  )
}
