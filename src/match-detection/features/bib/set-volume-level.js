// SetVolumeLevel
//
// Detects set vs volume vs component granularity from MARC record signals.
// Forces -1.0 (fail) when a clear mismatch is detected.

const CONF = {none: 0, low: 1, medium: 2, high: 3}

export default () => ({
  name: 'SetVolumeLevel',
  extract: ({record}) => {
    const v = {set: 0, volume: 0, component: 0}
    let vn = null, ty = null

    // Source 1: 020$q (w:3)
    const r1 = s1(record.get('020'))
    v.set += r1.s; v.volume += r1.v; v.component += r1.c
    if (r1.vn !== null) vn = r1.vn

    // Source 2: 245 (w:2)
    const r2 = s2(record.get('245'))
    v.set += r2.s; v.volume += r2.v; v.component += r2.c
    if (r2.vn !== null && vn === null) vn = r2.vn
    if (r2.ty !== null) ty = r2.ty

    // Source 3: 300 (w:2)
    const r3 = s3(record.get('300'))
    v.set += r3.s; v.volume += r3.v; v.component += r3.c

    // Source 4: 33x (w:2)
    v.component += s4(record.get('336'), record.get('337'), record.get('338'))

    // Source 5: 500 (w:1)
    const r5 = s5(record.get('500'))
    v.set += r5.s; v.component += r5.c

    const {type, confidence} = classify(v)
    // Own volume number beats set claim: a record that explicitly identifies
    // its volume number is a volume, even when other signals say set.
    const finalType = (type === 'set' && vn !== null) ? 'volume' : type
    return {type: finalType, confidence, volumeNumber: vn, titleYear: ty, votes: v}
  },

  compare: (a, b) => {
    if (a.type !== 'unknown' && b.type !== 'unknown' && a.type !== b.type) {
      if (CONF[a.confidence] >= 2 || CONF[b.confidence] >= 2) return -1.0
    }
    if (a.type === 'volume' && b.type === 'volume') {
      if (a.volumeNumber !== null && b.volumeNumber !== null && a.volumeNumber !== b.volumeNumber) return -1.0
    }
    if (a.titleYear !== null && b.titleYear !== null && a.titleYear !== b.titleYear) return -1.0
    return 0
  },
})

// ---------------------------------------------------------------------------
// Source 1: 020$q (w:3)
// ---------------------------------------------------------------------------

// Shared volume-keyword grammar. One dot rule: a dot after the keyword is
// optional everywhere. One boundary rule: no letter of any script may precede
// the keyword — JS \b is ASCII-only and never fires next to Cyrillic/ä in V8.
// The per-source keyword inventories remain distinct on purpose.
const volWordForm = (kws) => new RegExp(`(?<!\\p{L})(?:${kws})\\.?\\s*(\\d+)\\b`, 'iu')

const SET_KW = /^(?:kokonaisuus|complete set|hela verket|helhet|koko teoksen isbn|koko teos|set|setti|paketti|paket)\b/iu
const VOL_S1 = volWordForm('osa|vol|volume|os|t|bd|part')
// Number-first form ("2. osa"): same dot/boundary rules, captures the
// number — a volume vote must always come with its volume number.
const VOL_S1_NR = /\b(\d+)\.?\s*osa(?!\p{L})/iu
const COMP_KW = /\b(?:cd-äänilevy|cd-rom|äänikasetti)\b/iu
const COMP_PAT = /\d+\s*(?:cd-äänilevyä|kasettia)/iu

function s1(fields) {
  const qs = []
  let setLine = false, plainLine = false
  for (const f of fields) {
    const fqs = f.subfields.filter(sf => sf.code === 'q').map(sf => sf.value)
    qs.push(...fqs)
    if (fqs.some(q => SET_KW.test(q))) setLine = true
    else if (f.subfields.some(sf => sf.code === 'a')) plainLine = true
  }
  let hs = false, hv = false, hc = false, vn = null
  const distinctVn = new Set()
  for (const q of qs) {
    if (SET_KW.test(q)) hs = true
    const m = q.match(VOL_S1)
    if (m) {
      hv = true
      vn = +m[1]
      distinctVn.add(vn)
    } else {
      const m2 = q.match(VOL_S1_NR)
      if (m2) {
        hv = true
        vn = +m2[1]
        distinctVn.add(vn)
      }
    }
    if (COMP_KW.test(q) || COMP_PAT.test(q)) hc = true
  }
  // Q4 dual-ISBN rule: a set-qualifier ISBN together with at least one other
  // non-set-qualifier ISBN ⇒ the record is a volume, never confidently a set.
  // Multi-part exception: if the qualifiers carry ≥2 DISTINCT volume/part
  // numbers (e.g. "osa 1" + "osa 2"), the record is a complete work, not a
  // single volume — treat it exactly like the set-qualifier-only case (set
  // vote, vn null). The distinct-count test reuses the same extraction as vn
  // (VOL_S1 / VOL_S1_NR match), so it stays consistent with the volume number.
  // Single-part (0–1 distinct number) keeps the volume vote and preserves the
  // qualifier scan's volumeNumber (and component votes) so downstream
  // volume-number comparison still has its source; the volume vote is
  // max(3, scan vote) — conservative, since the scan alone can at most produce 3.
  if (setLine && plainLine) {
    if (distinctVn.size >= 2) return {s: 3, v: 0, c: 0, vn: null}
    const v = (hv ? 3 : 0)
    const c = (hc ? 3 : 0)
    return {s: 0, v: Math.max(3, v), c, vn}
  }
  if (hs) return {s: 3, v: 0, c: 0, vn: null}
  if (hv) return {s: 0, v: 3, c: 0, vn}
  if (hc) return {s: 0, v: 0, c: 3, vn: null}
  return {s: 0, v: 0, c: 0, vn: null}
}

// ---------------------------------------------------------------------------
// Source 2: 245 (w:2)
// ---------------------------------------------------------------------------

const VOL_KW = volWordForm('vol|volume|osa|band|part|book|tom|том')
const BRANGE = /^\s*\[\d+\s*[-–—]\s*\d+\]/
const NRANGE = /\d+\s*[-–—]\s*\d+/
const BBARE = /^\s*\[(\d+)\]\s*[,\/]?/
const BVOL_BR = /\[(?:vol\.?|volume|osa|band|part|book)\s*(\d+)\]/i
const BARE_N = /^\s*(\d+)\s*[,\/]/
const YEAR_RE = /\b(1\d{3}|2\d{3})\b/
const ALPHA_P = /\[\s*[A-ZÄÖÅ][A-Za-zäöå]*\s*[-–—]\s*[A-ZÄÖÅ][A-Za-zäöå]*\s*\]/u
const BARE_BR_AB = /\[(\d+)\]/

function s2(fields) {
  let s = 0, v = 0, c = 0, vn = null, ty = null
  for (const f of fields) {
    for (const sf of f.subfields || []) {
      const {code, value = ''} = sf
      if (code === 'n') {
        const t = value.trim()
        if (BRANGE.test(t)) { s += 2; continue }
        if (NRANGE.test(t)) { s += 2; continue }
        let m = t.match(BBARE)
        if (m) { v += 2; if (vn === null) vn = +m[1]; continue }
        m = t.match(BVOL_BR)
        if (m) { v += 2; if (vn === null) vn = +m[1]; continue }
        m = t.match(VOL_KW)
        if (m) { v += 2; if (vn === null) vn = +m[1]; continue }
        m = t.match(BARE_N)
        if (m) { v += 2; if (vn === null) vn = +m[1]; continue }
      }
      if (code === 'p' && ALPHA_P.test(value)) v += 2
      if (code === 'a' || code === 'b') {
        const m = value.match(VOL_KW)
        if (m) { v += 2; if (vn === null) vn = +m[1] }
        else {
          const bm = value.match(BARE_BR_AB)
          if (bm) { v += 2; if (vn === null) vn = +bm[1] }
        }
        if (code === 'a') {
          // A year found in the title sets titleYear (used as a mismatch veto
          // in compare) and additionally counts as a weak volume vote
          const ym = value.match(YEAR_RE)
          if (ym) { ty = +ym[1]; v += 1 }
        }
      }
    }
  }
  return {s, v, c, vn, ty}
}

// ---------------------------------------------------------------------------
// Source 3: 300 (w:2)
// ---------------------------------------------------------------------------

// JS \b is ASCII-only — it never matches after "ä" in V8; use a
// Unicode-aware letter lookahead, symmetric with the VOL_KW lookbehind.
const SET_EXT = /\b(\d+)\s*(?:nidettä(?!\p{L})|(?:vol|volumes|osa)\b)/ui
const CD_EXT = /\b\d+\s*cd-äänilevyä(?!\p{L})/iu
const HR_EXT = /\b\d+\s*h\.\s*$/iu

function s3(fields) {
  let s = 0, c = 0, bk = false
  const vals = fields.flatMap(f => f.subfields.filter(sf => sf.code === 'a').map(sf => sf.value))
  for (const v of vals) {
    const m = v.match(SET_EXT)
    if (m && +m[1] > 1) { s += 2; bk = true }
    if (CD_EXT.test(v) && !bk) c += 2
    if (HR_EXT.test(v)) c += 2
  }
  return {s, v: 0, c}
}

// ---------------------------------------------------------------------------
// Source 4: 33x (w:2)
// ---------------------------------------------------------------------------

function s4(f336, f337, f338) {
  const c338 = f338.flatMap(f => f.subfields.filter(sf => sf.code === 'a').map(sf => sf.value.toLowerCase()))
  const c336 = f336.flatMap(f => f.subfields.filter(sf => sf.code === 'a').map(sf => sf.value.toLowerCase()))
  const m337 = f337.flatMap(f => f.subfields.filter(sf => sf.code === 'a').map(sf => sf.value.toLowerCase()))
  const book = c338.some(v => v.includes('nide'))
  const text = c336.some(v => v.includes('teksti'))
  if (book || text) return 0
  const audioC = c338.some(v => /äänilevy|äänikasetti|tietolevy/.test(v))
  const speech = c336.some(v => v.includes('puhe'))
  const audioM = m337.some(v => v.includes('audio'))
  if (audioC || (speech && audioM)) return 2
  return 0
}

// ---------------------------------------------------------------------------
// Source 5: 500 (w:1)
// ---------------------------------------------------------------------------

function s5(fields) {
  let s = 0, c = 0
  const vals = fields.flatMap(f => f.subfields.filter(sf => sf.code === 'a').map(sf => sf.value.toLowerCase()))
  for (const v of vals) {
    if (/koko teos/.test(v)) s += 1
    if (/sisältää\s*\d*\s*cd/i.test(v) || /kirja\s*\+\s*(kasetti|cd)/i.test(v)) s += 1
    if (/liittyy samannimiseen/i.test(v)) c += 1
  }
  return {s, c}
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classify(votes) {
  const {set, volume, component} = votes
  const total = set + volume + component
  if (total === 0) return {type: 'unknown', confidence: 'none'}
  let type = 'set', mx = set
  if (volume > mx) { type = 'volume'; mx = volume }
  if (component > mx) { type = 'component'; mx = component }
  const conf = mx >= 3 ? 'high' : mx >= 2 ? 'medium' : 'low'
  return {type, confidence: conf}
}
