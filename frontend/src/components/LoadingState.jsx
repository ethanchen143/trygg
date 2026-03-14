import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Globe, CheckCircle2, Brain } from 'lucide-react'

function EventIcon({ event }) {
  if (event.type === 'tool_call') {
    if (event.tool === 'web_search') return <Globe size={14} />
    return <Search size={14} />
  }
  if (event.type === 'tool_result') return <CheckCircle2 size={14} />
  return <Brain size={14} />
}

export default function LoadingState({ events }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <motion.div
      className="loading-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="loading-pulse">
        <div className="loading-center-dot" />
      </div>

      <div className="loading-timeline">
        {events.length === 0 && (
          <div className="timeline-event timeline-status">
            <Brain size={14} />
            <span className="timeline-text">Starting analysis...</span>
          </div>
        )}
        {events.map((event, i) => (
          <motion.div
            key={i}
            className={`timeline-event timeline-${event.type}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EventIcon event={event} />
            <span className="timeline-text">
              {event.message || event.summary}
            </span>
            {event.type === 'tool_call' && (
              <span className="timeline-spinner" />
            )}
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>
    </motion.div>
  )
}
