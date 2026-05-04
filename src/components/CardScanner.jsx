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
    .replace(/\b(?:HP|DMG|x2|Retreat|Weakness|Resistance|Rule|Rules?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNoisyCandidate(candidate) {
  const c = candidate.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!c) return true
  if (/^\d+$/.test(c)) return false
  if (/^[a-z]{2,6}\d{2,4}$/i.test(candidate)) return false

  const noisyWords = new Set([
    'trad', 'train', 'traine', 'trainer', 'support', 'supporter',
    'item', 'stadium', 'energy', 'basic', 'stage', 'card', 'cards',
    'pokemon', 'pokmon', 'weakness', 'resistance', 'retreat',
    'ability', 'attack', 'damage', 'during', 'your', 'turn',
    // attack verbs / damage words that appear in attack text
    'place', 'discard', 'switch', 'attach', 'shuffle', 'search',
    'flip', 'coin', 'heads', 'tails', 'apply',
  ])

  if (noisyWords.has(c)) return true
  if (/^tra[a-z]{0,4}$/.test(c)) return true
  if (c.length <= 4 && !['mew', 'muk', 'jynx', 'hooh', 'abra', 'onix'].includes(c)) return true

  // G-Max / V-Max / Max attacks (e.g. "G-Max Pump", "Max Geist") — always attack names, not Pokémon names
  if (/^g[\s-]?max\b/i.test(candidate)) return true
  if (/^v[\s-]?max\b/i.test(candidate)) return true

  // Lines that look purely like attack damage values ("100+", "200×", etc.)
  if (/^\d+[+×x]?$/.test(candidate.trim())) return true

  return false
}

function buildSearchCandidates(text) {
  const rawLines = text
    .split(/\n+/)
    .map(line => line.replace(/[^\w\s.'/-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 3)
  const lines = rawLines
    .map(cleanOcrLine)
    .filter(line => line.length >= 3)

  // Priority-ordered candidates: [0]=best, appended in order of confidence
  const tier1 = []  // promo codes + combined name+number
  const tier2 = []  // names derived from HP-line context
  const tier3 = []  // generic name candidates
  const tier4 = []  // collector numbers alone (lowest confidence)

  const names = []
  const collectorNumbers = []

  // HP line: text before "XXX HP" is almost always the Pokémon name
  const hpLine = rawLines.find(line => /\b\d{2,3}\s*HP\b/i.test(line))
  if (hpLine) {
    const nameFromHp = cleanOcrLine(hpLine.replace(/\b\d{2,3}\s*HP\b.*$/i, ''))
    if (nameFromHp && !isNoisyCandidate(nameFromHp)) tier2.push(nameFromHp)
  }

  for (const line of lines) {
    // Promo set codes like "SVP039", "MEP033", "PR-SW001"
    const promoNumber = line.match(/\b[A-Z]{2,6}[-_]?\d{2,4}\b/i)?.[0]
    if (promoNumber) tier1.push(promoNumber)

    // Collector number from "XX/YYY" format
    const collectorMatch = line.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/)
    if (collectorMatch) collectorNumbers.push(collectorMatch[1])

    // Skip lines that are clearly attack names: G-Max, V-Max, and numbered damage
    if (/^(?:g[\s-]?max|v[\s-]?max)\b/i.test(line)) continue
    // Skip lines that are pure ability/attack section headers
    if (/^(?:ability|poke-?power|poke-?body|ancient\s+trait)\b/i.test(line)) continue

    const likelyName = line
      .replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, ' ')
      .replace(/\b\d{1,3}\b/g, ' ')
      .replace(/\b(?:Basic|Stage\s*\d?|Trainer|Supporter|Item|Stadium|Energy|Pokemon|Pokémon|Trad|Train|Traine)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const wordCount = likelyName.split(/\s+/).filter(Boolean).length
    if (likelyName.length >= 3 && likelyName.length <= 32 && wordCount <= 4) {
      names.push(likelyName)
      // Also try without suffix (e.g. "Charizard ex" → "Charizard")
      const baseName = likelyName.replace(/\b(?:ex|EX|GX|V|VMAX|VSTAR|GMAX)\b/g, '').trim()
      if (baseName && baseName !== likelyName) names.push(baseName)
    }
  }

  const cleanNames = [...new Set(names.map(c => cleanOcrLine(c)).filter(c => c && !isNoisyCandidate(c)))]
  const cleanNumbers = [...new Set(collectorNumbers.filter(Boolean))]

  // Combined name + number searches are most precise → tier1
  for (const name of cleanNames) {
    for (const number of cleanNumbers) tier1.push(`${name} ${number}`)
  }

  tier3.push(...cleanNames)
  tier4.push(...cleanNumbers)

  const all = [...tier1, ...tier2, ...tier3, ...tier4]
  return [...new Set(all.map(c => cleanOcrLine(c)).filter(c => c && !isNoisyCandidate(c)))]
}

function sortScannerResults(cards) {
  return [...cards].sort((a, b) => {
    const langA = a.card_language ?? 'en'
    const langB = b.card_language ?? 'en'
    if (langA === 'en' && langB !== 'en') return -1
    if (langA !== 'en' && langB === 'en') return 1

    const priceA = bestPrice(a) ?? -1
    const priceB = bestPrice(b) ?? -1
    if (priceA !== priceB) return priceB - priceA

    return (b.set?.releaseDate ?? '').localeCompare(a.set?.releaseDate ?? '')
  })
}

export default function CardScanner({ user, isDark = false, onToast, onCardAdded, onBack }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const workerRef = useRef(null)
  const detectingRef = useRef(false)
  const lastCandidateRef = useRef('')
  const lastRawTextRef = useRef('')  // frame stability: skip scan if text unchanged
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [query, setQuery] = useState('')
  const [detectedText, setDetectedText] = useState('')
  const [scanStatus, setScanStatus] = useState('Start the camera to scan automatically.')
  const [scanLocked, setScanLocked] = useState(false)
  const [matchedCandidate, setMatchedCandidate] = useState('')
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

  const readWithTesseract = useCallback(async (canvas) => {
    setScanStatus(workerRef.current ? 'Reading text with fallback OCR...' : 'Loading fallback OCR...')
    const { createWorker, PSM } = await import('tesseract.js')
    if (!workerRef.current) {
      workerRef.current = await createWorker('eng', 1, {
        logger: message => {
          if (message.status === 'recognizing text') {
            setScanStatus(`Reading text ${Math.round((message.progress || 0) * 100)}%...`)
          }
        },
      })
      await workerRef.current.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      })
    }

    const { data } = await workerRef.current.recognize(canvas)
    return data?.text ?? ''
  }, [])

  const runSearch = useCallback(async (nextQuery = query, { quiet = false } = {}) => {
    const trimmed = nextQuery.trim()
    if (!trimmed) return []

    setSearching(true)
    setScanStatus(`Searching database for "${trimmed}"...`)
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
    const sortedCards = sortScannerResults(cards ?? [])
    setResults(sortedCards)
    return sortedCards
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
        setMatchedCandidate(candidate)
        setScanLocked(true)
        setScanStatus(`Matched "${candidate}". Scan paused so results stay stable.`)
        return true
      }
    }

    setScanStatus('Text found, but no card match yet. Move closer to the card name or number.')
    if (!quiet) onToast?.('Text found, but no card match yet.')
    return false
  }, [onToast, runSearch])

  // Preprocess a canvas for foil/holo cards: convert to high-contrast grayscale
  // so OCR can read text on reflective holographic surfaces
  function preprocessCanvas(src) {
    const dst = document.createElement('canvas')
    dst.width  = src.width
    dst.height = src.height
    const ctx = dst.getContext('2d')
    ctx.drawImage(src, 0, 0)
    const imageData = ctx.getImageData(0, 0, dst.width, dst.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      // Luminance-weighted grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      // Apply contrast stretch: push mid-tones toward black/white
      // Factor 1.8 gives strong contrast without fully crushing shadows
      const contrasted = Math.max(0, Math.min(255, 128 + (gray - 128) * 1.8))
      data[i] = data[i + 1] = data[i + 2] = contrasted
    }
    ctx.putImageData(imageData, 0, 0)
    return dst
  }

  const captureAndDetect = useCallback(async ({ quiet = false } = {}) => {
    if (scanLocked) return
    if (detectingRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    detectingRef.current = true
    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 720
    canvas.width  = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, vw, vh)

    // Also create a cropped canvas focused on the top ~35% of the frame where the
    // Pokémon name appears — this drastically reduces noise from attacks and rules text.
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width  = vw
    cropCanvas.height = Math.round(vh * 0.35)
    cropCanvas.getContext('2d').drawImage(video, 0, 0, vw, vh, 0, 0, vw, cropCanvas.height)

    // Preprocess both canvases for foil/holo resilience
    const procCanvas = preprocessCanvas(canvas)
    const procCropCanvas = preprocessCanvas(cropCanvas)

    try {
      let rawText = ''
      if (supportsTextDetection) {
        const detector = new window.TextDetector()
        // Try both original and preprocessed; merge — preprocessing helps foil/holo
        const [cropDets, fullDets, procCropDets, procFullDets] = await Promise.all([
          detector.detect(cropCanvas),
          detector.detect(canvas),
          detector.detect(procCropCanvas),
          detector.detect(procCanvas),
        ])
        const cropText     = cropDets.map(d => d.rawValue).filter(Boolean).join('\n')
        const fullText     = fullDets.map(d => d.rawValue).filter(Boolean).join('\n')
        const procCropText = procCropDets.map(d => d.rawValue).filter(Boolean).join('\n')
        const procFullText = procFullDets.map(d => d.rawValue).filter(Boolean).join('\n')
        // Prefer cropped; include preprocessed results for foil cards
        const nameArea = cropText || procCropText
        rawText = nameArea
          ? `${nameArea}\n${fullText}\n${procFullText}`
          : (fullText || procFullText)
      }
      if (!rawText.trim()) {
        // Tesseract fallback: try preprocessed canvases first (better for foil)
        rawText = await readWithTesseract(procCropCanvas)
        if (!rawText.trim()) rawText = await readWithTesseract(procCanvas)
        if (!rawText.trim()) rawText = await readWithTesseract(cropCanvas)
        if (!rawText.trim()) rawText = await readWithTesseract(canvas)
      }

      // Frame stability: skip processing if we just saw identical text and already have results
      const normalised = rawText.replace(/\s+/g, ' ').trim()
      if (normalised && normalised === lastRawTextRef.current && results.length > 0) {
        detectingRef.current = false
        return
      }
      lastRawTextRef.current = normalised

      const candidates = buildSearchCandidates(rawText)
      setDetectedText(rawText || 'No readable text found. Try better lighting or move closer to the card name.')
      if (candidates.length) {
        await searchCandidates(candidates, { quiet })
      } else {
        setScanStatus('Looking for the card name or collector number...')
      }
    } catch (err) {
      setDetectedText('Text detection failed. Type the card name or number below.')
      setScanStatus('Automatic scan could not read this frame. Manual search is still available.')
      setCameraError(err?.message || '')
    } finally {
      detectingRef.current = false
    }
  }, [readWithTesseract, results, scanLocked, searchCandidates, supportsTextDetection])

  useEffect(() => () => {
    stopCamera()
    workerRef.current?.terminate?.()
  }, [stopCamera])

  useEffect(() => {
    if (!cameraOn) return undefined
    setScanStatus(supportsTextDetection ? 'Scanning automatically...' : 'Scanning with fallback OCR...')
    const id = window.setInterval(() => {
      captureAndDetect({ quiet: true })
    }, supportsTextDetection ? 1800 : 6500)
    return () => window.clearInterval(id)
  }, [cameraOn, captureAndDetect, supportsTextDetection])

  async function startCamera() {
    setCameraError('')
    setDetectedText('')
    setResults([])
    setScanLocked(false)
    setMatchedCandidate('')
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
      setScanStatus(supportsTextDetection ? 'Scanning automatically...' : 'Scanning with fallback OCR...')
    } catch (err) {
      setCameraError(err?.message || 'Camera permission was blocked.')
    }
  }

  function retryCurrentScan() {
    setScanLocked(false)
    setMatchedCandidate('')
    setResults([])
    lastCandidateRef.current = ''
    lastRawTextRef.current = ''
    setScanStatus(supportsTextDetection ? 'Scanning automatically...' : 'Scanning with fallback OCR...')
    captureAndDetect({ quiet: false })
  }

  function nextScan() {
    setQuery('')
    setDetectedText('')
    setResults([])
    setScanLocked(false)
    setMatchedCandidate('')
    lastCandidateRef.current = ''
    lastRawTextRef.current = ''
    setScanStatus(supportsTextDetection ? 'Ready for the next card.' : 'Ready for the next card with fallback OCR.')
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
              Point the camera at the card name or collector number. The scanner pauses after a match so results stay stable.
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

            {scanLocked && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={retryCurrentScan}
                  className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm ${
                    isDark ? 'bg-slate-900 text-violet-100 border border-violet-300/20' : 'bg-white text-violet-600 border border-violet-100'
                  }`}
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={nextScan}
                  className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-bold text-white shadow-sm"
                >
                  Next Scan
                </button>
              </div>
            )}

            {cameraError && <p className="text-xs font-semibold text-rose-400">{cameraError}</p>}
            {!supportsTextDetection && (
              <p className={`text-xs ${isDark ? 'text-violet-100/60' : 'text-slate-500'}`}>
                This browser does not support native camera text detection, so Pokepop is using fallback OCR. First scan can take a little longer.
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
          {scanLocked && matchedCandidate && (
            <div className={`sm:col-span-2 lg:col-span-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
              isDark ? 'bg-emerald-300/10 text-emerald-100 border border-emerald-300/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              Results locked for "{matchedCandidate}". Use Retry to rescan this card or Next Scan for a new card.
            </div>
          )}
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
