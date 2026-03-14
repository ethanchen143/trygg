import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, ArrowRight, User } from 'lucide-react'

export default function ChatThread({ history, awaitingReply, onReply, loading }) {
  const [reply, setReply] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, awaitingReply])

  const handleSubmit = () => {
    if (!reply.trim()) return
    const msg = reply
    setReply('')
    onReply(msg)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="chat-thread">
      {history.map((msg, i) => (
        <motion.div
          key={i}
          className={`chat-message chat-${msg.role}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="chat-avatar">
            {msg.role === 'user' ? <User size={14} /> : <MessageCircle size={14} />}
          </div>
          <div className="chat-bubble">
            {msg.content.split('\n').map((line, j) => (
              <p key={j}>{line || '\u00A0'}</p>
            ))}
          </div>
        </motion.div>
      ))}

      {awaitingReply && !loading && (
        <motion.div
          className="chat-reply-input"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add more detail about your business..."
            rows={3}
            autoFocus
          />
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!reply.trim()}
          >
            Send
            <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
