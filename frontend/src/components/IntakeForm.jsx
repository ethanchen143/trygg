import { motion } from 'framer-motion'

export default function IntakeForm({
  businessDescription,
  onDescriptionChange,
  budget,
  onBudgetChange,
  onAnalyze,
  loading,
}) {
  const presets = [5000, 10000, 25000, 50000]

  return (
    <motion.section
      className="intake-section"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
    >
      <div className="field-label">Tell us about your business</div>
      <textarea
        className="intake-textarea"
        placeholder="I run a small electronics import business sourcing components from Shenzhen, China. Revenue is $3.2M with 12% margins, and 80% of my supply comes from China..."
        value={businessDescription}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />

      <div className="field-label">Total Premium</div>
      <div className="budget-input-row">
        <div className="budget-input-wrap">
          <span className="budget-input-prefix">$</span>
          <input
            type="number"
            className="budget-input"
            value={budget}
            min={100}
            step={1000}
            onChange={(e) => onBudgetChange(Number(e.target.value) || 0)}
          />
        </div>
        <div className="budget-presets">
          {presets.map((val) => (
            <button
              key={val}
              className={`budget-preset${budget === val ? ' budget-preset--active' : ''}`}
              onClick={() => onBudgetChange(val)}
            >
              ${val >= 1000 ? `${val / 1000}k` : val}
            </button>
          ))}
        </div>
      </div>
      <div className="budget-sub">Capital at risk — allocated across your hedge portfolio</div>

      <button
        className="analyze-btn"
        onClick={onAnalyze}
        disabled={!businessDescription.trim() || loading || budget < 100}
      >
        Get Protection
      </button>
    </motion.section>
  )
}
