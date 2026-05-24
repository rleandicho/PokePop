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

// Words that are ALWAYS noise — they never appear as a standalone card name
// and filtering them regardless of context is safe.
const ALWAYS_NOISY = new Set([
  'trad', 'train', 'traine', 'trainer', 'support', 'supporter',
  'pokemon', 'pokmon', 'weakness', 'resistance', 'retreat',
  'ability', 'attack', 'damage', 'during', 'your', 'turn',
  'flip', 'coin', 'heads', 'tails', 'apply',
])

// Words that are noisy when they appear ALONE (single-word candidate) but are
// legitimate parts of multi-word Trainer card names: "Energy Search", "Switch",
// "Rare Candy", "Ultra Ball" etc. — only block when wordCount === 1.
const CONTEXT_NOISY_SOLO = new Set([
  'item', 'stadium', 'energy', 'basic', 'stage', 'card', 'cards',
  'place', 'discard', 'switch', 'attach', 'shuffle', 'search',
])

function isNoisyCandidate(candidate) {
  const c = candidate.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!c) return true
  if (/^\d+$/.test(c)) return false
  if (/^[a-z]{2,6}\d{2,4}$/i.test(candidate)) return false

  if (ALWAYS_NOISY.has(c)) return true
  if (/^tra[a-z]{0,4}$/.test(c)) return true

  // Context-noisy words: only block when the entire candidate is that one word.
  // "Energy Search" (wordCount=2) passes; bare "Energy" (wordCount=1) is blocked.
  const wordCount = candidate.trim().split(/\s+/).filter(Boolean).length
  if (wordCount === 1 && CONTEXT_NOISY_SOLO.has(c)) return true

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

  // Trainer card heuristic: Trainer cards print the sub-type ("Item", "Supporter",
  // "Stadium") on a line by itself below the artwork. The line immediately BEFORE
  // that in the raw OCR output is almost always the card name.
  // e.g.  rawLines = ["Energy Search", "Item", ...]  → tier1 gets "Energy Search"
  //        rawLines = ["Switch", "Item", ...]          → tier1 gets "Switch"
  const trainerTypeIdx = rawLines.findIndex(line => /^(item|supporter|stadium)$/i.test(line.trim()))
  if (trainerTypeIdx > 0) {
    const trainerNameLine = cleanOcrLine(rawLines[trainerTypeIdx - 1])
    if (trainerNameLine && !isNoisyCandidate(trainerNameLine)) {
      tier1.push(trainerNameLine)
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
      .replace(/\b(?:Basic|Stage\s*\d?|Trainer|Supporter|Item|Stadium|Pokemon|Pokémon|Trad|Train|Traine)\b/gi, ' ')
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

  // Consecutive-line pairs: OCR sometimes splits a two-word Trainer name across
  // separate lines (e.g. "Energy" on one line, "Search" on the next). Combining
  // adjacent cleaned lines recovers "Energy Search", "Rare Candy", etc.
  for (let i = 0; i < lines.length - 1; i++) {
    const pair = `${lines[i]} ${lines[i + 1]}`.replace(/\s+/g, ' ').trim()
    if (pair.length >= 4 && pair.length <= 32) {
      const pairCleaned = cleanOcrLine(pair)
      if (pairCleaned && !isNoisyCandidate(pairCleaned)) {
        tier3.push(pairCleaned)
      }
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
  const scanLockedRef = useRef(false)       // mirrors scanLocked state — safe to read in stale closures
  const triedCandidatesRef = useRef(new Set()) // all candidates tried for the current text frame
  const resultsCountRef = useRef(0)         // mirrors results.length — avoids re-creating the interval on every result change
  const lastRawTextRef = useRef('')         // frame stability: skip scan if text unchanged
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [query, setQuery] = useState('')
  const [detectedText, setDetectedText] = useState('')
  const [scanStatus, setScanStatus] = useState('Start the camera to scan automatically.')
  const [scanLocked, setScanLockedState] = useState(false)
  // Keep ref in sync so captureAndDetect always sees the current lock value
  // even when the interval closure captured a stale version of the state.
  const setScanLocked = useCallback((v) => {
    scanLockedRef.current = v
    setScanLockedState(v)
  }, [])
  const [matchedCandidate, setMatchedCandidate] = useState('')
  const [results, setResults] = useState([])
  const [resultsPage, setResultsPage] = useState(1)
  const [searching, setSearching] = useState(false)
  const [savingId, setSavingId] = useState('')

  const RESULTS_PER_PAGE = 8

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

  const readWithTesseract = useCallback(async (canvas, psm = null) => {
    const { createWorker, PSM } = await import('tesseract.js')
    if (!workerRef.current) {
      setScanStatus('Loading OCR engine...')
      workerRef.current = await createWorker('eng', 1, { logger: () => {} })
      await workerRef.current.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    }
    // Temporarily switch PSM if requested, then restore SPARSE_TEXT afterwards.
    // The worker is single-threaded so there's no race — all calls queue through it.
    if (psm !== null) {
      await workerRef.current.setParameters({ tessedit_pageseg_mode: psm })
    }
    const { data } = await workerRef.current.recognize(canvas)
    if (psm !== null) {
      await workerRef.current.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    }
    return data?.text ?? ''
  }, [])

  const runSearch = useCallback(async (nextQuery = query, { quiet = false } = {}) => {
    const trimmed = nextQuery.trim()
    if (!trimmed) return []

    setSearching(true)
    setScanStatus(`Searching database for "${trimmed}"...`)
    // Prefer English results — try English-only first, fall back to all languages.
    // pageSize: 40 lets us paginate client-side without extra DB calls per page flip.
    const { cards: enCards, error } = await fetchCardsFromDb({
      search: trimmed, sort: 'newest', page: 1, pageSize: 40, langFilter: 'en',
    })
    setSearching(false)

    if (error) {
      if (!quiet) onToast?.('Could not search cards. Try again.')
      return []
    }

    if (enCards?.length) {
      const sorted = sortScannerResults(enCards)
      setResults(sorted)
      setResultsPage(1)
      return sorted
    }

    // No English results — search all languages
    setSearching(true)
    const { cards: allCards } = await fetchCardsFromDb({
      search: trimmed, sort: 'newest', page: 1, pageSize: 40,
    })
    setSearching(false)
    const sortedAll = sortScannerResults(allCards ?? [])
    setResults(sortedAll)
    setResultsPage(1)
    return sortedAll
  }, [onToast, query])

  // Pure data fetch — does not touch component state. Used by parallel candidate search.
  //
  // Strategy (in order):
  //   1. Exact English name  — avoids "Rotom" pulling Heat/Wash Rotom variants AND foreign cards
  //   2. Exact any-language  — for cards that only exist in foreign sets
  //   3. Substring English   — catches partial OCR reads, promo codes, collector-number combos
  //   4. Substring any-lang  — final fallback so we always show something
  //
  // English-first is critical: fetchCardsFromDb caps results at pageSize=8, so without
  // a lang filter the 8 slots can fill entirely with foreign printings of the same card.
  const rawSearch = useCallback(async (candidate) => {
    const trimmed = candidate?.trim()
    if (!trimmed) return []
    try {
      const isNameOnly = /^[a-zA-ZÀ-ÿ\s'\u2019-]+$/.test(trimmed) && trimmed.length >= 3

      if (isNameOnly) {
        // 1. Exact English
        const { cards: exactEn } = await fetchCardsFromDb({
          exactName: trimmed, sort: 'newest', page: 1, pageSize: 40, langFilter: 'en',
        })
        if (exactEn?.length) return sortScannerResults(exactEn)

        // 2. Exact any-language (Japanese-only cards, foreign-exclusive sets)
        const { cards: exactAll } = await fetchCardsFromDb({
          exactName: trimmed, sort: 'newest', page: 1, pageSize: 40,
        })
        if (exactAll?.length) return sortScannerResults(exactAll)
      }

      // 3. Substring English (promo codes, collector-number combos, partial names)
      const { cards: subEn } = await fetchCardsFromDb({
        search: trimmed, sort: 'newest', page: 1, pageSize: 40, langFilter: 'en',
      })
      if (subEn?.length) return sortScannerResults(subEn)

      // 4. Substring any-language — last resort
      const { cards: subAll } = await fetchCardsFromDb({
        search: trimmed, sort: 'newest', page: 1, pageSize: 40,
      })
      return sortScannerResults(subAll ?? [])
    } catch {
      return []
    }
  }, [])

  const searchCandidates = useCallback(async (candidates, { quiet = false } = {}) => {
    if (!candidates.length) return false

    // Skip candidates already tried for this text frame.
    // Uses a Set (triedCandidatesRef) so ALL previously-tried candidates are excluded,
    // not just the single last one tracked by the old lastCandidateRef string.
    const fresh = candidates.filter(c => c && !triedCandidatesRef.current.has(c))
    if (!fresh.length) return false

    const lockResult = (winner, cards) => {
      triedCandidatesRef.current.clear() // next scan starts fresh
      setQuery(winner)
      setResults(cards)
      resultsCountRef.current = cards.length
      setResultsPage(1)
      setMatchedCandidate(winner)
      setScanLocked(true)
      setScanStatus(`Matched "${winner}". Scan paused so results stay stable.`)
    }

    // Fire the top 3 candidates in parallel — network round-trips dominate,
    // so parallel requests are ~3x faster than sequential when name+number
    // combos are available.
    const top = fresh.slice(0, 3)
    setScanStatus(`Checking "${top[0]}"${top.length > 1 ? ` + ${top.length - 1} more` : ''}...`)
    setSearching(true)
    const parallelResults = await Promise.all(top.map(c => rawSearch(c)))
    setSearching(false)

    // Mark all parallel candidates as tried regardless of outcome
    top.forEach(c => triedCandidatesRef.current.add(c))

    const winnerIdx = parallelResults.findIndex(r => r.length > 0)
    if (winnerIdx >= 0) {
      lockResult(top[winnerIdx], parallelResults[winnerIdx])
      return true
    }

    // Fall back to remaining candidates sequentially
    for (const candidate of fresh.slice(3, 8)) {
      setScanStatus(`Checking "${candidate}"...`)
      triedCandidatesRef.current.add(candidate)
      setSearching(true)
      const cards = await rawSearch(candidate)
      setSearching(false)
      if (cards.length) {
        lockResult(candidate, cards)
        return true
      }
    }

    setScanStatus('Text found, but no card match yet. Move closer to the card name or number.')
    if (!quiet) onToast?.('Text found, but no card match yet.')
    return false
  }, [onToast, rawSearch, setScanLocked])

  // Upscale a canvas before Tesseract — 2× scale dramatically improves recognition
  // of small text (collector numbers, set symbols) which are typically rendered at
  // ~72 effective DPI on a phone camera; Tesseract was designed for 300 DPI.
  function upscaleCanvas(src, scale = 2) {
    const dst = document.createElement('canvas')
    dst.width  = src.width  * scale
    dst.height = src.height * scale
    const ctx = dst.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, dst.width, dst.height)
    return dst
  }

  // Preprocess a canvas for OCR: convert to high-contrast grayscale.
  // For foil/holo Pokémon cards (light background, dark text) this is a standard
  // contrast boost. For Trainer cards with dark colored banners (blue/purple/green)
  // the text is white-on-dark — we auto-detect this (or force-invert) and invert
  // before contrasting so Tesseract always gets dark text on a light background.
  //
  // forceInvert=true skips luminance sampling and always inverts — used to run a
  // second Tesseract pass so we catch Trainer banners even when the auto-detect
  // threshold is borderline.
  function preprocessCanvas(src, forceInvert = false) {
    const dst = document.createElement('canvas')
    dst.width  = src.width
    dst.height = src.height
    const ctx = dst.getContext('2d')
    ctx.drawImage(src, 0, 0)
    const imageData = ctx.getImageData(0, 0, dst.width, dst.height)
    const data = imageData.data

    // Sample average luminance from the top ~35% of the crop (the name banner area).
    // Threshold raised to 120 — Trainer card blue/teal/purple banners typically read
    // as 100–120, which was previously slipping under the old 100 cutoff.
    let isDarkBackground = forceInvert
    if (!forceInvert) {
      let lumSum = 0
      const sampleRows = Math.min(Math.floor(dst.height * 0.35), 60)
      const samplePixels = dst.width * sampleRows
      for (let i = 0; i < samplePixels * 4; i += 4) {
        lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      const avgLum = samplePixels > 0 ? lumSum / samplePixels : 128
      isDarkBackground = avgLum < 120
    }

    for (let i = 0; i < data.length; i += 4) {
      let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      // Invert dark backgrounds so white-on-dark text becomes black-on-white
      if (isDarkBackground) gray = 255 - gray
      // Contrast stretch: push mid-tones toward black/white (factor 1.8)
      const contrasted = Math.max(0, Math.min(255, 128 + (gray - 128) * 1.8))
      data[i] = data[i + 1] = data[i + 2] = contrasted
    }
    ctx.putImageData(imageData, 0, 0)
    return dst
  }

  const captureAndDetect = useCallback(async ({ quiet = false } = {}) => {
    if (scanLockedRef.current) return  // use ref — always current, not a stale closure value
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

    // Focused crops: top 30% for the Pokémon/Trainer name (wider than the old 25%
    // so the full name banner is captured even when the card isn't perfectly centered),
    // bottom 15% for the collector number (nn/NNN printed at the bottom of the card).
    const nameCanvas = document.createElement('canvas')
    nameCanvas.width  = vw
    nameCanvas.height = Math.round(vh * 0.30)
    nameCanvas.getContext('2d').drawImage(video, 0, 0, vw, vh, 0, 0, vw, nameCanvas.height)

    const numCanvas = document.createElement('canvas')
    numCanvas.width  = vw
    numCanvas.height = Math.round(vh * 0.15)
    numCanvas.getContext('2d').drawImage(video, 0, vh - numCanvas.height, vw, numCanvas.height, 0, 0, vw, numCanvas.height)

    // Preprocess the name crop for foil/holo resilience (grayscale + contrast boost).
    // The full canvas and number strip are left as-is — TextDetector handles
    // standard contrast well, and number text is typically printed clearly.
    const procNameCanvas = preprocessCanvas(nameCanvas)

    try {
      let rawText = ''
      if (supportsTextDetection) {
        const detector = new window.TextDetector()
        // 4 parallel calls: preprocessed name crop (foil/Trainer safe after inversion),
        // raw color name crop (Chrome's TextDetector handles color natively — extra signal
        // for Trainer card dark banners), number strip, and full frame as catch-all.
        const [nameDets, rawNameDets, numDets, fullDets] = await Promise.all([
          detector.detect(procNameCanvas),
          detector.detect(nameCanvas),
          detector.detect(numCanvas),
          detector.detect(canvas),
        ])
        const nameText = [...nameDets, ...rawNameDets].map(d => d.rawValue).filter(Boolean).join('\n')
        const numText  = numDets.map(d => d.rawValue).filter(Boolean).join('\n')
        const fullText = fullDets.map(d => d.rawValue).filter(Boolean).join('\n')
        rawText = [nameText, numText, fullText].filter(Boolean).join('\n')
      }
      let candidates = []
      if (!rawText.trim()) {
        // Tesseract fallback: upscale 2× before each pass — Tesseract was designed for
        // 300 DPI scans and reads small card text much more reliably at double resolution.
        //
        // Run TWO passes on the name crop:
        //   Pass 1 (PSM.SINGLE_LINE): auto-preprocessed — handles dark/light backgrounds,
        //     holofoil noise. PSM.SINGLE_LINE is better than SPARSE_TEXT for a name banner
        //     because it tells Tesseract the whole crop is one horizontal text line.
        //   Pass 2 (PSM.SINGLE_LINE): raw color nameCanvas — white text on colored Trainer
        //     banners (blue/teal/purple) converts to ~134 luminance via Tesseract's internal
        //     grayscale, giving high natural contrast without any preprocessing artifacts.
        //     This often outperforms our preprocessed version on dark banner Trainer cards.
        setScanStatus('Reading card name...')
        const { PSM } = await import('tesseract.js')
        const [nameText, nameTextRaw] = await Promise.all([
          readWithTesseract(upscaleCanvas(procNameCanvas), PSM.SINGLE_LINE),
          readWithTesseract(upscaleCanvas(nameCanvas), PSM.SINGLE_LINE),
        ])
        setScanStatus('Reading collector number...')
        const numText  = await readWithTesseract(upscaleCanvas(numCanvas))
        rawText = [nameText, nameTextRaw, numText].filter(Boolean).join('\n')
        candidates = buildSearchCandidates(rawText)
        if (!candidates.length) {
          setScanStatus('Reading full card...')
          const fullText = await readWithTesseract(upscaleCanvas(preprocessCanvas(canvas)))
          rawText = [rawText, fullText].filter(Boolean).join('\n')
          candidates = buildSearchCandidates(rawText)
        }
      } else {
        candidates = buildSearchCandidates(rawText)
      }

      // Frame stability: skip processing if we just saw identical text and already have results.
      // Uses resultsCountRef (not results.length) to avoid stale closure values.
      const normalised = rawText.replace(/\s+/g, ' ').trim()
      if (normalised && normalised === lastRawTextRef.current && resultsCountRef.current > 0) {
        detectingRef.current = false
        return
      }
      // Text changed — clear the tried-candidates set so the new frame gets a clean slate
      if (normalised !== lastRawTextRef.current) {
        triedCandidatesRef.current.clear()
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
  // scanLocked and results intentionally omitted — both are accessed via refs
  // (scanLockedRef, resultsCountRef) so stale closure values are never a problem.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readWithTesseract, searchCandidates, supportsTextDetection])

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
    resultsCountRef.current = 0
    setScanLocked(false)
    setMatchedCandidate('')
    triedCandidatesRef.current.clear()
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
    resultsCountRef.current = 0
    setResultsPage(1)
    triedCandidatesRef.current.clear()
    lastRawTextRef.current = ''
    setScanStatus(supportsTextDetection ? 'Scanning automatically...' : 'Scanning with fallback OCR...')
    captureAndDetect({ quiet: false })
  }

  function nextScan() {
    setQuery('')
    setDetectedText('')
    setResults([])
    resultsCountRef.current = 0
    setResultsPage(1)
    setScanLocked(false)
    setMatchedCandidate('')
    triedCandidatesRef.current.clear()
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

        {(() => {
          const totalResultPages = Math.ceil(results.length / RESULTS_PER_PAGE)
          const visibleResults = results.slice(
            (resultsPage - 1) * RESULTS_PER_PAGE,
            resultsPage * RESULTS_PER_PAGE,
          )
          return (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {scanLocked && matchedCandidate && (
                  <div className={`sm:col-span-2 lg:col-span-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    isDark ? 'bg-emerald-300/10 text-emerald-100 border border-emerald-300/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    Results for "{matchedCandidate}" — {results.length} printing{results.length !== 1 ? 's' : ''} found.
                    {totalResultPages > 1 && ` Showing page ${resultsPage} of ${totalResultPages}.`}
                    {' '}Use Retry to rescan or Next Scan for a new card.
                  </div>
                )}
                {visibleResults.map(card => {
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

              {/* Pagination bar — only shown when there's more than one page of results */}
              {totalResultPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-5 flex-wrap">
                  <button
                    onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                    disabled={resultsPage === 1}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all
                      disabled:opacity-30 disabled:cursor-not-allowed
                      ${isDark
                        ? 'bg-slate-900 border-violet-300/20 text-violet-100 hover:bg-slate-800'
                        : 'bg-white/70 border-gray-200 text-gray-500 hover:bg-white/90'
                      }`}
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalResultPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setResultsPage(p)}
                      className={`w-9 h-9 rounded-full text-sm font-semibold border transition-all
                        ${p === resultsPage
                          ? 'bg-pink-400 text-white border-pink-400 shadow-sm'
                          : isDark
                            ? 'bg-slate-900 border-violet-300/20 text-violet-100 hover:bg-slate-800'
                            : 'bg-white/70 text-gray-500 border-gray-200 hover:bg-white/90'
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setResultsPage(p => Math.min(totalResultPages, p + 1))}
                    disabled={resultsPage === totalResultPages}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all
                      disabled:opacity-30 disabled:cursor-not-allowed
                      ${isDark
                        ? 'bg-slate-900 border-violet-300/20 text-violet-100 hover:bg-slate-800'
                        : 'bg-white/70 border-gray-200 text-gray-500 hover:bg-white/90'
                      }`}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )
        })()}

        {!searching && query && results.length === 0 && (
          <p className={`mt-5 text-center text-sm ${isDark ? 'text-violet-100/60' : 'text-slate-500'}`}>
            No matches yet. Try the card name, set code, or collector number.
          </p>
        )}
      </div>
    </section>
  )
}
