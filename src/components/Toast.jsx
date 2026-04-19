import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [message, onDone])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{  opacity: 0, y: 40,  scale: 0.9 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] theme-panel-strong
                     backdrop-blur-md text-pink-600 font-semibold
                     px-6 py-3 rounded-2xl shadow-xl border border-pink-200
                     text-sm whitespace-nowrap"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
