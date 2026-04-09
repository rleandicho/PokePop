import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Auth({ user, username }) {
  const [open,      setOpen]      = useState(false)
  const [isSignUp,  setIsSignUp]  = useState(false)
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const emailRef = useRef(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => emailRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open, isSignUp])

  function openModal() {
    setIsSignUp(false)
    setEmail('')
    setPassword('')
    setError(null)
    setConfirmed(false)
    setOpen(true)
  }

  function switchMode(toSignUp) {
    setIsSignUp(toSignUp)
    setEmail('')
    setPassword('')
    setError(null)
    setConfirmed(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) { setError(error.message); return }
      setConfirmed(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) { setError(error.message); return }
      setOpen(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  // ── Logged-in ────────────────────────────────────────────────────────────────
  if (user) {
    return (
      <div className="flex items-center gap-2 justify-center flex-wrap">
        <span className="text-xs text-pink-400 font-semibold">
          ✨ {username ? `@${username}` : user.email}
        </span>
        <button
          onClick={handleSignOut}
          className="text-xs bg-white/60 hover:bg-white/90 text-pink-500 font-semibold
                     px-3 py-1 rounded-full border border-pink-200 transition-all"
        >
          Sign Out
        </button>
      </div>
    )
  }

  // ── Logged-out ───────────────────────────────────────────────────────────────
  return (
    <div className="flex justify-center">
      <button
        onClick={openModal}
        className="text-xs bg-white/60 hover:bg-white/90 text-pink-500 font-semibold
                   px-4 py-1.5 rounded-full border border-pink-200 transition-all shadow-sm"
      >
        Login to save cards 💖
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(255,209,220,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              key="modal"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{    scale: 0.85, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center"
            >
              <h2 className="text-2xl font-bold text-pink-500 mb-1">
                {isSignUp ? 'Create account 🌷' : 'Welcome back! 🌸'}
              </h2>
              <p className="text-sm text-gray-400 mb-5">
                {isSignUp
                  ? 'Pick an email and password to get started'
                  : 'Sign in with your email and password'}
              </p>

              {/* Toggle */}
              <div className="flex rounded-2xl bg-pink-50 p-1 mb-5 gap-1">
                <button
                  type="button"
                  onClick={() => switchMode(false)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all
                    ${!isSignUp
                      ? 'bg-pink-400 text-white shadow-sm'
                      : 'text-gray-400 hover:text-pink-400'}`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode(true)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all
                    ${isSignUp
                      ? 'bg-pink-400 text-white shadow-sm'
                      : 'text-gray-400 hover:text-pink-400'}`}
                >
                  Sign Up
                </button>
              </div>

              {/* Signup confirmation */}
              {confirmed ? (
                <div className="text-pink-500 font-semibold">
                  Almost there! ✨<br />
                  <span className="text-gray-400 text-sm font-normal">
                    Check your inbox and confirm your email to activate your account.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="border border-pink-200 rounded-2xl px-4 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-pink-300
                               text-gray-600 bg-pink-50/50"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                    minLength={6}
                    className="border border-pink-200 rounded-2xl px-4 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-pink-300
                               text-gray-600 bg-pink-50/50"
                  />
                  {error && (
                    <p className="text-red-400 text-xs text-left px-1">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-pink-400 hover:bg-pink-500 text-white font-semibold
                               py-2.5 rounded-2xl transition-colors disabled:opacity-60"
                  >
                    {loading
                      ? (isSignUp ? 'Creating account…' : 'Signing in…')
                      : (isSignUp ? 'Create Account 🌸' : 'Log In ✨')}
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
