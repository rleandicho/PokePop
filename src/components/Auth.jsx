import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Auth({ user, username }) {
  const [open,    setOpen]    = useState(false)
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function sendMagicLink(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  if (user) {
    const displayName = username ?? user.email
    return (
      <div className="flex items-center gap-2 justify-center flex-wrap">
        <span className="text-xs text-pink-400 font-semibold">
          ✨ {username ? `@${username}` : user.email}
        </span>
        <button
          onClick={logout}
          className="text-xs bg-white/60 hover:bg-white/90 text-pink-500 font-semibold
                     px-3 py-1 rounded-full border border-pink-200 transition-all"
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs bg-white/60 hover:bg-white/90 text-pink-500 font-semibold
                   px-4 py-1.5 rounded-full border border-pink-200 transition-all shadow-sm"
      >
        Login to save cards 💖
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(255,209,220,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center"
            >
              <h2 className="text-2xl font-bold text-pink-500 mb-1">Welcome back! 🌸</h2>
              <p className="text-sm text-gray-400 mb-6">Enter your email for a magic login link</p>

              {sent ? (
                <div className="text-pink-500 font-semibold">
                  Check your inbox! ✨<br />
                  <span className="text-gray-400 text-sm font-normal">Click the link to sign in.</span>
                </div>
              ) : (
                <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="border border-pink-200 rounded-2xl px-4 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-pink-300 text-gray-600
                               bg-pink-50/50"
                  />
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-pink-400 hover:bg-pink-500 text-white font-semibold
                               py-2.5 rounded-2xl transition-colors disabled:opacity-60"
                  >
                    {loading ? 'Sending…' : 'Send Magic Link ✨'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
