import { useRef, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Globe, CheckCircle2, Brain, Radar, BarChart3, Shield } from 'lucide-react'

function EventIcon({ event }) {
  if (event.type === 'tool_call') {
    if (event.tool === 'web_search') return <Globe size={15} />
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
            <motion.div
              key={i}
              className={`feed-event feed-event--${event.type}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
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
              {event.type === 'tool_result' && (
                <span className="feed-event-done">Done</span>
              )}
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </motion.div>
  )
}
