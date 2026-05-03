import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCardsFromDb } from '../lib/cardDb'

function bestPrice(card) {
  return (
    card.market_price ??
    card.tcgplayer?.prices?.holofoil?.market ??
    card.tcgplayer?.prices?.normal?.market ??
    card.tcgplayer?.prices?.reverseHolofoil?.market ??
    card.tcgplayer?.prices?.other?.market ??
    null
  )
}

function priceFallback(card, field) {
  return (
    card.tcgplayer?.prices?.holofoil?.[field] ??
    card.tcgplayer?.prices?.normal?.[field] ??
    card.tcgplayer?.prices?.reverseHolofoil?.[field] ??
    card.tcgplayer?.prices?.other?.[field] ??
    null
  )
}

function cleanOcrLine(line) {
  return line
    .replace(/[^\w\s.'/-]/g, ' ')
    .replace(/\b(?:HP|DMG|x2|Retreat|Weakness|Resistance)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchCandidates(text) {
  const rawLines = text
    .split(/\n+/)
    .map(line => line.replace(/[^\w\s.'/-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 3)
  const lines = rawLines
    .map(cleanOcrLine)
    .filter(line => line.length >= 3)

  const candidates = []
  const hpLine = rawLines.find(line => /\b\d{2,3}\s*HP\b/i.test(line))
  if (hpLine) candidates.push(cleanOcrLine(hpLine.replace(/\b\d{2,3}\s*HP\b.*$/i, '')))

  for (const line of lines) {
    const promoNumber = line.match(/\b[A-Z]{2,6}\d{2,4}\b/i)?.[0]
    if (promoNumber) candidates.push(promoNumber)

    const collectorNumber = line.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/)?.[1]
    if (collectorNumber) candidates.push(collectorNumber)

    const likelyName = line
      .replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, ' ')
      .replace(/\b\d{1,3}\b/g, ' ')
      .replace(/\b(?:Basic|Stage|Trainer|Supporter|Item|Stadium|Energy|Pokemon|Pokémon)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const wordCount = likelyName.split(/\s+/).filter(Boolean).length
    if (likelyName.length >= 3 && likelyName.length <= 32 && wordCount <= 4) {
      candidates.push(likelyName)
      candidates.push(likelyName.replace(/\b(?:ex|EX|GX|V|VMAX|VSTAR)\b/g, '').trim())
    }
  }

  return [...new Set(candidates.map(c => cleanOcrLine(c)).filter(c => c.length >= 2))]
}

export default function CardScanner({ user, isDark = false, onToast, onCardAdded, onBack }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const detectingRef = useRef(false)
  const lastCandidateRef = useRef('')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [query, setQuery] = useState('')
  const [detectedText, setDetectedText] = useState('')
  const [scanStatus, setScanStatus] = useState('Start the camera to scan automatically.')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [savingId, setSavingId] = useState('')

  const supportsTextDetection = useMemo(
    () => typeof window !== 'undefined' && 'TextDetector' in window,
    []
  )

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  const runSearch = useCallback(async (nextQuery = query, { quiet = false } = {}) => {
    const trimmed = nextQuery.trim()
    if (!trimmed) return []

    setSearching(true)
    const { cards, error } = await fetchCardsFromDb({
      search: trimmed,
      sort: 'newest',
      page: 1,
      pageSize: 8,
    })
    setSearching(false)

    if (error) {
      if (!quiet) onToast?.('Could not search cards. Try again.')
      return []
    }
    setResults(cards ?? [])
    return cards ?? []
  }, [onToast, query])

  const searchCandidates = useCallback(async (candidates, { quiet = false } = {}) => {
    if (!candidates.length) return false

    for (const candidate of candidates.slice(0, 8)) {
      if (!candidate || candidate === lastCandidateRef.current) continue
      lastCandidateRef.current = candidate
      setQuery(candidate)
      setScanStatus(`Checking "${candidate}"...`)
      const cards = await runSearch(candidate, { quiet: true })
      if (cards.length) {
        setScanStatus(`Matched "${candidate}"`)
        return true
      }
    }

    setScanStatus('Text found, but no card match yet. Move closer to the card name or number.')
    if (!quiet) onToast?.('Text found, but no card match yet.')
    return false
  }, [onToast, runSearch])

  const captureAndDetect = useCallback(async ({ quiet = false } = {}) => {
    if (detectingRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    detectingRef.current = true
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (!supportsTextDetection) {
      setDetectedText('This browser does not support camera text detection yet. Type the card name or number below.')
      setScanStatus('Manual search is needed in this browser.')
      if (!quiet) onToast?.('Type the card name or number to search.')
      detectingRef.current = false
      return
    }

    try {
      const detector = new window.TextDetector()
      const detections = await detector.detect(canvas)
      const rawText = detections.map(item => item.rawValue).filter(Boolean).join('\n')
      const candidates = buildSearchCandidates(rawText)
      setDetectedText(rawText || 'No readable text found. Try better lighting or move closer to the card name.')
      if (candidates.length) {
        await searchCandidates(candidates, { quiet })
      } else {
        setScanStatus('Looking for the card name or collector number...')
      }
    } catch (err) {
      setDetectedText('Text detection failed. Type the card name or number below.')
      setScanStatus('Automatic scan paused. Manual search is still available.')
      setCameraError(err?.message || '')
    } finally {
      detectingRef.current = false
    }
  }, [onToast, searchCandidates, supportsTextDetection])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (!cameraOn) return undefined
    setScanStatus(supportsTextDetection ? 'Scanning automatically...' : 'Manual search is needed in this browser.')
    const id = window.setInterval(() => {
      captureAndDetect({ quiet: true })
    }, 1800)
    return () => window.clearInterval(id)
  }, [cameraOn, captureAndDetect, supportsTextDetection])

  async function startCamera() {
    setCameraError('')
    setDetectedText('')
    setResults([])
    lastCandidateRef.current = ''
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOn(true)
      setScanStatus('Scanning automatically...')
    } catch (err) {
      setCameraError(err?.message || 'Camera permission was blocked.')
    }
  }

  async function saveCard(card, owned) {
    if (!user) {
      onToast?.('Login to save scanned cards.')
      return
    }

    setSavingId(`${card.id}-${owned ? 'owned' : 'wish'}`)
    const payload = {
      user_id: user.id,
      card_id: card.id,
      name: card.name,
      image: card.images?.small,
      market_price: bestPrice(card),
      mid_price: card.mid_price ?? priceFallback(card, 'mid'),
      low_price: card.low_price ?? priceFallback(card, 'low'),
      owned,
      edition: 'unspecified',
      language: 'english',
    }
    if (owned) payload.quantity = 1

    const { error } = await supabase
      .from('wishlists')
      .upsert(payload, { onConflict: 'user_id,card_id,edition,language' })

    setSavingId('')
    if (error) {
      onToast?.('Could not save card.')
      return
    }

    onCardAdded?.(card.id, owned, 'english')
    onToast?.(owned ? 'Added to collection.' : 'Added to wishlist.')
  }

  return (
    <section className="px-4 pb-24">
      <div className={`mx-auto max-w-5xl rounded-[2rem] border p-4 sm:p-6 shadow-xl ${
        isDark
          ? 'bg-slate-950/70 border-violet-300/20 text-violet-50'
          : 'bg-white/75 border-pink-100 text-slate-700'
      }`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className={`text-xs uppercase tracking-[0.25em] font-bold ${isDark ? 'text-violet-300' : 'text-pink-400'}`}>
              Card Scanner
            </p>
            <h2 className="text-2xl sm:text-3xl font-black mt-1">Scan or search a card</h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-violet-100/70' : 'text-slate-500'}`}>
              Point the camera at the card name or collector number. The scanner will keep checking while the camera is on.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border ${
              isDark ? 'border-violet-300/30 text-violet-100' : 'border-pink-200 text-pink-500'
            }`}
          >
            Back
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div className={`rounded-[1.5rem] overflow-hidden border ${
            isDark ? 'bg-slate-900 border-violet-300/20' : 'bg-slate-100 border-white'
          }`}>
            <div className="aspect-[3/4] sm:aspect-video relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />
              {!cameraOn && (
                <div className={`absolute inset-0 grid place-items-center p-6 text-center ${
                  isDark ? 'text-violet-100/70' : 'text-slate-500'
                }`}>
                  <div>
                    <div className="mx-auto mb-3 h-16 w-16 rounded-full border-4 border-current grid place-items-center font-black">
                      Scan
                    </div>
                    <p className="text-sm font-semibold">Start the camera to line up a Pokemon card.</p>
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cameraOn ? stopCamera : startCamera}
                className="rounded-full bg-gradient-to-r from-pink-400 to-violet-500 px-4 py-2 text-sm font-bold text-white shadow-md"
              >
                {cameraOn ? 'Stop Camera' : 'Start Camera'}
              </button>
              <button
                type="button"
                onClick={() => captureAndDetect({ quiet: false })}
                disabled={!cameraOn}
                className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-45 ${
                  isDark ? 'bg-violet-200 text-slate-950' : 'bg-white text-violet-600'
                }`}
              >
                Scan Now
              </button>
            </div>

            <p className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
              isDark ? 'bg-slate-900/70 text-violet-100/70' : 'bg-pink-50 text-slate-500'
            }`}>
              {scanStatus}
            </p>

            {cameraError && <p className="text-xs font-semibold text-rose-400">{cameraError}</p>}
            {!supportsTextDetection && (
              <p className={`text-xs ${isDark ? 'text-violet-100/60' : 'text-slate-500'}`}>
                Camera text detection is not supported in every browser yet. Manual search is available below.
              </p>
            )}

            <form
              onSubmit={e => { e.preventDefault(); runSearch() }}
              className="flex gap-2"
            >
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Card name, number, or set"
                className={`min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none ${
                  isDark
                    ? 'bg-slate-900/80 border-violet-300/20 text-violet-50 placeholder:text-violet-100/35'
                    : 'bg-white border-pink-100 text-slate-700 placeholder:text-slate-300'
                }`}
              />
              <button
                type="submit"
                className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-white shadow-sm"
              >
                {searching ? '...' : 'Search'}
              </button>
            </form>

            {detectedText && (
              <details className={`rounded-2xl p-3 text-xs ${isDark ? 'bg-slate-900/70 text-violet-100/70' : 'bg-pink-50 text-slate-500'}`}>
                <summary className="cursor-pointer font-bold">Detected text</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans">{detectedText}</pre>
              </details>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {results.map(card => {
            const price = bestPrice(card)
            return (
              <article
                key={card.id}
                className={`rounded-3xl border p-3 shadow-sm ${
                  isDark ? 'bg-slate-900/70 border-violet-300/20' : 'bg-white/85 border-pink-100'
                }`}
              >
                <img
                  src={card.images?.small}
                  alt={card.name}
                  className="mx-auto aspect-[2.5/3.5] w-full max-w-36 rounded-xl object-contain"
                />
                <div className="mt-3">
                  <h3 className="text-sm font-black leading-tight">{card.name}</h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-violet-100/60' : 'text-slate-400'}`}>
                    {card.set?.name} #{card.number}
                  </p>
                  <p className="mt-2 text-lg font-black text-emerald-400">
                    {price ? `$${Number(price).toFixed(2)}` : 'No price'}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!!savingId}
                    onClick={() => saveCard(card, false)}
                    className="rounded-full bg-violet-400 px-2 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {savingId === `${card.id}-wish` ? '...' : 'Wishlist'}
                  </button>
                  <button
                    type="button"
                    disabled={!!savingId}
                    onClick={() => saveCard(card, true)}
                    className="rounded-full bg-emerald-400 px-2 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {savingId === `${card.id}-owned` ? '...' : 'Collect'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {!searching && query && results.length === 0 && (
          <p className={`mt-5 text-center text-sm ${isDark ? 'text-violet-100/60' : 'text-slate-500'}`}>
            No matches yet. Try the card name, set code, or collector number.
          </p>
        )}
      </div>
    </section>
  )
}
