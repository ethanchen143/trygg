export default function MarketDepthBar({ yesPrice, noPrice, size = 'default' }) {
  const yes = Math.round((yesPrice || 0) * 100)
  const no = Math.round((noPrice || 1 - (yesPrice || 0)) * 100)
  const isLarge = size === 'large'

  return (
    <div className={`depth-bar-container ${isLarge ? 'depth-bar--large' : ''}`}>
      <div className="depth-bar-labels">
        <span className="depth-bar-label depth-bar-yes">
          <span className="depth-bar-label-dot yes" />
          YES {yes}%
        </span>
        <span className="depth-bar-label depth-bar-no">
          NO {no}%
          <span className="depth-bar-label-dot no" />
        </span>
      </div>
      <div className="depth-bar">
        <div className="depth-bar-fill yes" style={{ width: `${yes}%` }} />
        <div className="depth-bar-fill no" style={{ width: `${no}%` }} />
      </div>
    </div>
  )
}
