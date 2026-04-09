import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function UsernameSetup({ user, onSaved }) {
  const [username, setUsername] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const clean = username.trim().replace(/\s+/g, '_')
    if (!clean) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('profiles').upsert({
      id:       user.id,
      username: clean,
    })

    setLoading(false)
    if (error) {
      setError(error.code === '23505' ? 'That name is taken — try another! 🌸' : error.message)
    } else {
      onSaved(clean)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(255,209,220,0.65)', backdropFilter: 'blur(10px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 260 }}
        className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center"
      >
        <div className="text-4xl mb-3">🌸</div>
        <h2 className="text-2xl font-bold text-pink-500 mb-1">Pick your Collector Name!</h2>
        <p className="text-sm text-gray-400 mb-6">
          This is how you'll appear on your wishlist and dashboard.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="e.g. SylveonCollector"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={30}
            required
            autoFocus
            className="border border-pink-200 rounded-2xl px-4 py-2.5 text-sm text-gray-600
                       bg-pink-50/50 focus:outline-none focus:ring-2 focus:ring-pink-300
                       text-center font-semibold placeholder:font-normal placeholder:text-pink-300"
          />
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="bg-pink-400 hover:bg-pink-500 disabled:opacity-50 text-white
                       font-semibold py-2.5 rounded-2xl transition-colors"
          >
            {loading ? 'Saving…' : "Let's go! ✨"}
          </button>
          <button
            type="button"
            onClick={() => onSaved(null)}
            className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
          >
            Maybe later
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
