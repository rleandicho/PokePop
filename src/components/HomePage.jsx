import { motion } from 'framer-motion'

// ─── Full vibe list — bento grid + Surprise Me pool ──────────────────────────
const ALL_VIBES = [
  { id: 'girlypop',    label: 'Girlypop',    emoji: '🌸', bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-200',    desc: 'Cute & soft cards' },
  { id: 'space',       label: 'Space',       emoji: '✨', bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200',  desc: 'Cosmic & celestial' },
  { id: 'darkfairy',   label: 'Dark Fairy',  emoji: '🖤', bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-200',  desc: 'Mysterious vibes' },
  { id: 'cottagecore', label: 'Cottagecore', emoji: '🌿', bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-200',   desc: 'Cozy & botanical' },
  { id: 'nature',      label: 'Nature',      emoji: '🌱', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', desc: 'Grass-type gallery' },
  { id: 'pastel',      label: 'Pastel',      emoji: '🍬', bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-200',  desc: 'Fairy-type softies' },
  { id: 'trainers',    label: 'Trainers',    emoji: '🃏', bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  desc: 'Supporters & items' },
  { id: 'fullart',     label: 'Full Art',    emoji: '🎨', bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', desc: 'Rare art showcase' },
]

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item      = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }

export default function HomePage({ user, collectionIds, ownedIds, onNavigate }) {
  const totalCards    = collectionIds?.size ?? 0
  const ownedCards    = ownedIds?.size      ?? 0
  const wishlistCards = totalCards - ownedCards

  function handleSurpriseMe() {
    const pick = ALL_VIBES[Math.floor(Math.random() * ALL_VIBES.length)]
    onNavigate(pick.id)
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-5">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 sm:p-8 text-center
                   bg-gradient-to-br from-pink-100 via-white to-sky-100
                   border border-pink-200 shadow-md"
      >
        <p className="text-4xl mb-2">🌸</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-pink-500 mb-1">
          {user ? 'Welcome back!' : 'Discover your vibe'}
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          {user
            ? 'Your Pokémon card collection, beautifully curated.'
            : 'Browse 10,000+ Pokémon cards filtered by aesthetic — no account needed.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {user ? (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('wishlist')}
              className="bg-white hover:bg-pink-50 text-pink-500 font-semibold
                         px-6 py-2.5 rounded-full border border-pink-200 shadow-sm transition-all text-sm"
            >
              My Collection 📦
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('all')}
              className="bg-white hover:bg-sky-50 text-sky-500 font-semibold
                         px-6 py-2.5 rounded-full border border-sky-200 shadow-sm transition-all text-sm"
            >
              Browse All 🌐
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ── Stats row — only shown when logged in and have cards ──────────── */}
      {user && totalCards > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: 'Total Saved', value: totalCards,    emoji: '🗂️', bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-600' },
            { label: 'Owned',       value: ownedCards,    emoji: '✅', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
            { label: 'Wishlist',    value: wishlistCards, emoji: '💖', bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-600' },
          ].map(s => (
            <div key={s.label}
                 className={`${s.bg} ${s.border} border rounded-2xl p-3 sm:p-4 text-center shadow-sm`}>
              <p className="text-xl sm:text-2xl mb-0.5">{s.emoji}</p>
              <p className={`text-xl sm:text-2xl font-bold ${s.text}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 font-medium">{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Actions + Vibe grid — flex-col stack ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
        className="flex flex-col gap-4"
      >
        {/* TOP: Browse All Cards — full-width primary CTA */}
        <button
          onClick={() => onNavigate('all')}
          className="w-full flex flex-col items-center justify-center p-6 rounded-2xl
                     bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg
                     hover:shadow-xl transition-all cursor-pointer group"
        >
          <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">🌐</span>
          <p className="font-bold text-xl leading-tight">Browse All Cards</p>
          <p className="text-sm opacity-80 mt-0.5">Every Pokémon, every set</p>
        </button>

        {/* MIDDLE: Vibe grid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2 px-1">Browse by Vibe</h3>
          <motion.div
            variants={container} initial="hidden" animate="show"
            className="grid grid-cols-2 md:grid-cols-3 gap-3"
          >
            {ALL_VIBES.map(v => (
              <motion.button
                key={v.id}
                variants={item}
                whileHover={{ scale: 1.04, boxShadow: '0 8px 24px rgba(255,182,193,0.35)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onNavigate(v.id)}
                className={`${v.bg} ${v.border} ${v.text} border rounded-2xl p-4 text-left
                            shadow-sm transition-all cursor-pointer`}
              >
                <p className="text-2xl mb-1">{v.emoji}</p>
                <p className="font-bold text-sm leading-tight">{v.label}</p>
                <p className="text-[11px] opacity-70 mt-0.5">{v.desc}</p>
              </motion.button>
            ))}
          </motion.div>
        </div>

        {/* BOTTOM: Surprise Me — full-width */}
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(168,85,247,0.3)' }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSurpriseMe}
          className="w-full flex flex-col items-center justify-center p-6 rounded-2xl
                     bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-lg
                     hover:shadow-xl transition-all cursor-pointer group"
        >
          <span className="text-3xl mb-1 group-hover:rotate-12 transition-transform">🎲</span>
          <p className="font-bold text-xl leading-tight">Surprise Me</p>
          <p className="text-sm opacity-80 mt-0.5">Random vibe, random adventure</p>
        </motion.button>
      </motion.div>

    </div>
  )
}
