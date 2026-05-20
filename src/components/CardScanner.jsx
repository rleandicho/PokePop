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
  // Short names (≤4 chars) are noisy — except for real Pokémon with short names
  const shortAllowlist = new Set(['mew', 'muk', 'jynx', 'hooh', 'abra', 'onix', 'seel'])
  if (c.length <= 4 && !shortAllowlist.has(c)) return true

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

  // HP line: text before "XXX HP" is almost always the Pokémon name.
  // Lives in tier2 (below promo codes and name+number combos in tier1) because
  // a specific "Rotom 23" hit is more useful than a bare "Rotom" name hit.
  const hpLine = rawLines.find(line => /\b\d{2,3}\s*HP\b/i.test(line))
  if (hpLine) {
    const nameFromHp = cleanOcrLine(hpLine.replace(/\b\d{2,3}\s*HP\b.*$/i, ''))
    if (nameFromHp && !isNoisyCandidate(nameFromHp)) {
      tier2.push(nameFromHp)
      // Also try the base name without suffix (e.g. "Rotom ex" → "Rotom")
      const base = nameFromHp.replace(/\b(?:ex|EX|GX|V|VMAX|VSTAR|GMAX)\b/g, '').trim()
      if (base && base !== nameFromHp && !isNoisyCandidate(base)) tier2.push(base)
    }
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

  // Pre-warm the Tesseract worker in the background so it's ready when needed.
  // Called right after the camera opens to avoid a 5-10s delay on first scan.
  const warmTesseract = useCallback(async () => {
    if (workerRef.current) return
    try {
      const { createWorker, PSM } = await import('tesseract.js')
      workerRef.current = await createWorker('eng', 1, { logger: () => {} })
      await workerRef.current.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    } catch {}
  }, [])

  const readWithTesseract = useCallback(async (canvas) => {
    const { createWorker, PSM } = await import('tesseract.js')
    if (!workerRef.current) {
      setScanStatus('Loading OCR engine...')
      workerRef.current = await createWorker('eng', 1, { logger: () => {} })
      await workerRef.current.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
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

  // Pure data fetch — does not touch component state. Used by parallel candidate search.
  // For text-only name candidates (no digits / set codes), we try an exact case-insensitive
  // match first so "Rotom" doesn't also pull Heat Rotom, Wash Rotom, etc. Only fall back
  // to the broader substring search if the exact match returns nothing.
  const rawSearch = useCallback(async (candidate) => {
    const trimmed = candidate?.trim()
    if (!trimmed) return []
    try {
      const isNameOnly = /^[a-zA-ZÀ-ÿ\s'\u2019-]+$/.test(trimmed) && trimmed.length >= 3
      if (isNameOnly) {
        const { cards: exact } = await fetchCardsFromDb({
          exactName: trimmed, sort: 'newest', page: 1, pageSize: 8,
        })
        const exactSorted = sortScannerResults(exact ?? [])
        if (exactSorted.length) return exactSorted
      }
      // Substring fallback — also used for promo codes, collector-number combos, etc.
      const { cards } = await fetchCardsFromDb({ search: trimmed, sort: 'newest', page: 1, pageSize: 8 })
      return sortScannerResults(cards ?? [])
    } catch {
      return []
    }
  }, [])

  const searchCandidates = useCallback(async (candidates, { quiet = false } = {}) => {
    if (!candidates.length) return false

    const fresh = candidates.filter(c => c && c !== lastCandidateRef.current)
    if (!fresh.length) return false

    // Fire the top 3 candidates in parallel — network round-trips dominate,
    // so parallel requests are ~3x faster than sequential when name+number
    // combos are available.
    const top = fresh.slice(0, 3)
    setScanStatus(`Checking "${top[0]}"${top.length > 1 ? ` + ${top.length - 1} more` : ''}...`)
    setSearching(true)
    const parallelResults = await Promise.all(top.map(c => rawSearch(c)))
    setSearching(false)

    const winnerIdx = parallelResults.findIndex(r => r.length > 0)
    if (winnerIdx >= 0) {
      const winner = top[winnerIdx]
      lastCandidateRef.current = winner
      setQuery(winner)
      setResults(parallelResults[winnerIdx])
      setMatchedCandidate(winner)
      setScanLocked(true)
      setScanStatus(`Matched "${winner}". Scan paused so results stay stable.`)
      return true
    }
    // Update ref so we don't retry these exact candidates next frame
    lastCandidateRef.current = top[top.length - 1]

    // Fall back to remaining candidates sequentially
    for (const candidate of fresh.slice(3, 8)) {
      setScanStatus(`Checking "${candidate}"...`)
      setSearching(true)
      const cards = await rawSearch(candidate)
      setSearching(false)
      if (cards.length) {
        lastCandidateRef.current = candidate
        setQuery(candidate)
        setResults(cards)
        setMatchedCandidate(candidate)
        setScanLocked(true)
        setScanStatus(`Matched "${candidate}". Scan paused so results stay stable.`)
        return true
      }
    }

    setScanStatus('Text found, but no card match yet. Move closer to the card name or number.')
    if (!quiet) onToast?.('Text found, but no card match yet.')
    return false
  }, [onToast, rawSearch])

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

    // Focused crops: top 20% for the Pokémon name (name + HP line lives here),
    // bottom 12% for the collector number (nn/NNN printed at the bottom of the card).
    // Tighter regions = less noise from attack text, faster Tesseract passes.
    const nameCanvas = document.createElement('canvas')
    nameCanvas.width  = vw
    nameCanvas.height = Math.round(vh * 0.20)
    nameCanvas.getContext('2d').drawImage(video, 0, 0, vw, vh, 0, 0, vw, nameCanvas.height)

    const numCanvas = document.createElement('canvas')
    numCanvas.width  = vw
    numCanvas.height = Math.round(vh * 0.12)
    numCanvas.getContext('2d').drawImage(video, 0, vh - numCanvas.height, vw, numCanvas.height, 0, 0, vw, numCanvas.height)

    // Preprocess the name crop for foil/holo resilience (grayscale + contrast boost).
    // The full canvas and number strip are left as-is — TextDetector handles
    // standard contrast well, and number text is typically printed clearly.
    const procNameCanvas = preprocessCanvas(nameCanvas)

    try {
      let rawText = ''
      if (supportsTextDetection) {
        const detector = new window.TextDetector()
        // 2 calls: preprocessed name crop (foil-safe) + original full frame (catches set/number info).
        // Reduced from 4 parallel calls — each detect() is a native GPU pass, so halving the count
        // meaningfully cuts frame processing time.
        const [nameDets, fullDets] = await Promise.all([
          detector.detect(procNameCanvas),
          detector.detect(canvas),
        ])
        const nameText = nameDets.map(d => d.rawValue).filter(Boolean).join('\n')
        const fullText = fullDets.map(d => d.rawValue).filter(Boolean).join('\n')
        rawText = nameText ? `${nameText}\n${fullText}` : fullText
      }
      let candidates = []
      if (!rawText.trim()) {
        // Tesseract fallback: name crop first (fast — small area), then the number
        // strip (also fast), then full card only if still nothing found.
        setScanStatus('Reading card name...')
        const nameText = await readWithTesseract(procNameCanvas)
        setScanStatus('Reading collector number...')
        const numText  = await readWithTesseract(numCanvas)
        rawText = [nameText, numText].filter(Boolean).join('\n')
        candidates = buildSearchCandidates(rawText)
        if (!candidates.length) {
          setScanStatus('Reading full card...')
          const fullText = await readWithTesseract(preprocessCanvas(canvas))
          rawText = [rawText, fullText].filter(Boolean).join('\n')
          candidates = buildSearchCandidates(rawText)
        }
      } else {
        candidates = buildSearchCandidates(rawText)
      }

      // Frame stability: skip processing if we just saw identical text and already have results
      const normalised = rawText.replace(/\s+/g, ' ').trim()
      if (normalised && normalised === lastRawTextRef.current && results.length > 0) {
        detectingRef.current = false
        return
      }
      lastRawTextRef.current = normalised

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
    // TextDetector is a native GPU call (near-instant), so 700 ms feels responsive
    // without hammering the DB. Tesseract takes 2-4 s per pass so 3000 ms is plenty.
    const id = window.setInterval(() => {
      captureAndDetect({ quiet: true })
    }, supportsTextDetection ? 700 : 3000)
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
      // 1280×720 is the sweet spot for card scanning — more than enough detail
      // for OCR while keeping canvas operations fast. 1080p adds no OCR benefit
      // and significantly slows down pixel manipulation on mid-range phones.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOn(true)
      setScanStatus('Camera ready — point at the card name...')
      // Pre-warm Tesseract in the background so it's ready if TextDetector fails.
      // This avoids the 5-10 second cold-start delay on the first Tesseract scan.
      warmTesseract()
      // Fire the first scan after the video stream has a chance to render a frame.
      setTimeout(() => captureAndDetect({ quiet: true }), 900)
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
