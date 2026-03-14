import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, User } from 'lucide-react'

export default function ChatThread({ history, awaitingReply, onReply, loading }) {
  const [reply, setReply] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, awaitingReply])

  useEffect(() => {
    if (awaitingReply && !loading) {
      inputRef.current?.focus()
    }
  }, [awaitingReply, loading])

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
      {history.map((msg, i) => {
        const isUser = msg.role === 'user'
        return (
          <motion.div
            key={i}
            className={`chat-message chat-${msg.role}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="chat-avatar-row">
              <div className={`chat-avatar ${isUser ? 'chat-avatar--user' : 'chat-avatar--ai'}`}>
                {isUser ? <User size={14} /> : <Shield size={14} />}
              </div>
              <span className="chat-role">{isUser ? 'You' : 'Trygg'}</span>
            </div>
            <div className="chat-bubble-wrap">
              <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--ai'}`}>
                {msg.content.split('\n').map((line, j) => (
                  <p key={j}>{line || '\u00A0'}</p>
                ))}
              </div>
            </div>
          </motion.div>
        )
      })}

      {awaitingReply && !loading && (
        <motion.div
          className="chat-reply-input"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <textarea
            ref={inputRef}
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add more detail about your business..."
            rows={3}
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
