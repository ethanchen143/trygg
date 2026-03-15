import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import Hero from './components/Hero'
import IntakeForm from './components/IntakeForm'
import LoadingState from './components/LoadingState'
import Results from './components/Results'
import ChatThread from './components/ChatThread'
import Footer from './components/Footer'
import { MOCK_RESULTS } from './data/mockResults'
import { transformResponse } from './utils/transformResponse'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || ''

function App() {
  const [businessDescription, setBusinessDescription] = useState('')
  const [budget, setBudget] = useState(10000)
  const [loading, setLoading] = useState(false)
  const [streamEvents, setStreamEvents] = useState([])
  const [results, setResults] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [awaitingReply, setAwaitingReply] = useState(false)
  const [relatedMarkets, setRelatedMarkets] = useState([])

  const runAnalysis = useCallback(async (query, analysisBudget) => {
    if (!query.trim()) return

    setChatHistory(prev => [...prev, { role: 'user', content: query }])
    setLoading(true)
    setStreamEvents([])
    setResults(null)
    setAwaitingReply(false)
    setRelatedMarkets([])

    try {
      const response = await fetch(`${API_URL}/prediction-markets/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, budget: analysisBudget || 10000 }),
      })

      if (!response.ok) {
        throw new Error(`Analysis failed (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue

          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'recommendations') {
              setResults(transformResponse(event.data))
            } else if (event.type === 'related_markets') {
              setRelatedMarkets(event.data || [])
            } else if (event.type === 'conversation') {
              setChatHistory(prev => [...prev, { role: 'assistant', content: event.message }])
              setAwaitingReply(true)
            } else if (event.type === 'error') {
              setChatHistory(prev => [...prev, { role: 'assistant', content: event.message }])
              setAwaitingReply(true)
            } else {
              setStreamEvents(prev => [...prev, event])
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      console.error('Stream failed, using mock data for demo:', err.message)
      setResults(MOCK_RESULTS)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAnalyze = useCallback(() => {
    runAnalysis(businessDescription, budget)
    setBusinessDescription('')
  }, [businessDescription, budget, runAnalysis])

  const handleReply = useCallback((message) => {
    setAwaitingReply(false)
    runAnalysis(message)
  }, [runAnalysis])

  const handleReset = useCallback(() => {
    setResults(null)
    setChatHistory([])
    setBusinessDescription('')
    setStreamEvents([])
    setAwaitingReply(false)
    setRelatedMarkets([])
  }, [])

  const hasStarted = chatHistory.length > 0 || loading || results

  return (
    <div className="app">
      <Header />
      <main className={`main${hasStarted ? ' main--wide' : ''}`}>
        <AnimatePresence mode="wait">
          {!hasStarted && (
            <motion.div
              key="landing"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Hero />
              <IntakeForm
                businessDescription={businessDescription}
                onDescriptionChange={setBusinessDescription}
                budget={budget}
                onBudgetChange={setBudget}
                onAnalyze={handleAnalyze}
                loading={loading}
              />
            </motion.div>
          )}

          {hasStarted && (
            <motion.div
              key="analysis"
              className="analysis-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <ChatThread
                history={chatHistory}
                awaitingReply={awaitingReply}
                onReply={handleReply}
                loading={loading}
              />

              <AnimatePresence mode="wait">
                {loading && <LoadingState events={streamEvents} key="loading" />}
              </AnimatePresence>

              {results && !loading && (
                <Results data={results} onReset={handleReset} relatedMarkets={relatedMarkets} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}

export default App
