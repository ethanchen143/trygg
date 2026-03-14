import { motion } from 'framer-motion'
import LiveTicker from './LiveTicker'

export default function Hero() {
  return (
    <>
      <motion.section
        className="hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1>Hedge risks <span className="accent">no one else</span> will insure</h1>
        <div className="hero-accent-line" />
        <p className="hero-sub">
          AI-powered protection using prediction markets.
        </p>
        <div className="hero-steps">
          <span>Describe</span>
          <span className="hero-steps-dot" />
          <span>Analyze</span>
          <span className="hero-steps-dot" />
          <span>Hedge</span>
        </div>
      </motion.section>
      <LiveTicker />
    </>
  )
}
