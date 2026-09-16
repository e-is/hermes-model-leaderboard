import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { NewsPanel } from './components/NewsPanel'
import { api } from './doors'
import { useLeaderboardI18n } from './i18n'
import { computeGenericScore, parseTargetLangs } from './core/scoring'

// ---- Types --------------------------------------------------
type GpuInfo = { param_count_b: number; vram_q4_gb: number; vram_q8_gb: number; vram_fp16_gb: number; fits_64gb: boolean } | null

type ModelRecord = {
  id: string; label: string; name?: string
  context_length?: number
  prompt_price?: number | null; completion_price?: number | null
  cache_read_price?: number | null; cache_write_price?: number | null
  web_search_price?: number | null; internal_reasoning_price?: number | null
  input_modalities?: string[]; output_modalities?: string[]
  available: boolean; added_at?: number; last_updated?: number
  description?: string; supported_parameters?: string[]
  modality?: string; has_vision?: boolean
  intelligence_index?: number | null; coding_index?: number | null; agentic_index?: number | null
  hugging_face_id?: string | null; open_weights?: boolean
  model_size?: string | null; reasoning?: boolean; hidden?: boolean
  benchmarks?: Record<string, number | null>
  iso_langs?: string[]
  gpu?: GpuInfo
}

type SearchHit = {
  id: string; name: string; context_length?: number
  prompt_price?: number; completion_price?: number
  open_weights?: boolean; model_size?: string | null; has_vision?: boolean
}

export type ProfileConfig = {
  id: string
  name: string
  weights: Record<string, number>
  /** Langues cibles pour le critère "languages" (ex. "en, fr, de") */
  targetLangs?: string
}

type NewsTimeWindow = '1m' | '2m' | '3m' | '6m' | '1y' | 'all'
type NewsSortBy = 'date' | 'score'


type NewModelItem = {
  id: string
  name: string
  created: number
  context_length?: number
  prompt_price?: number | null
  completion_price?: number | null
  cache_read_price?: number | null
  has_vision?: boolean
  open_weights?: boolean
  supported_parameters?: string[]
  intelligence_index?: number | null
  coding_index?: number | null
  agentic_index?: number | null
  is_tracked?: boolean
}

type PriceChangeItem = {
  id: string
  changed_at?: number
  old_prompt?: number | null
  new_prompt?: number | null
  old_completion?: number | null
  new_completion?: number | null
  old_cache_read?: number | null
  new_cache_read?: number | null
  percent_change: number
  is_tracked?: boolean
}

type PromotionItem = {
  id: string
  name: string
  discount_text: string
  details: string
  context_length?: number
  prompt_price?: number | null
  completion_price?: number | null
  cache_read_price?: number | null
  has_vision?: boolean
  open_weights?: boolean
  supported_parameters?: string[]
  intelligence_index?: number | null
  coding_index?: number | null
  agentic_index?: number | null
  is_tracked?: boolean
}

type NewsData = {
  new_models: NewModelItem[]
  price_changes: PriceChangeItem[]
  promotions: PromotionItem[]
}

// Available criteria list for weighting
export const AVAILABLE_CRITERIA = [
  { key: 'intelligence', label: 'Intelligence globale', icon: '🧠', desc: 'Indice Artificial Analysis intelligence (raisonnement & logique)' },
  { key: 'coding', label: 'Génération de code', icon: '💻', desc: 'Indice Artificial Analysis coding (syntaxe & algo)' },
  { key: 'agentic', label: 'Capacités agentiques', icon: '🤖', desc: 'Indice Artificial Analysis agentic (autonomie & multi-tâches)' },
  { key: 'price_in', label: 'Price ↓ input', icon: '📥', desc: 'Pondère favorablement les modèles économiques en entrée' },
  { key: 'price_out', label: 'Price ↓ output', icon: '📤', desc: 'Pondère favorablement les modèles économiques en génération' },
  { key: 'cache_read', label: 'Price ↓ cache', icon: '⚡', desc: 'Pondère favorablement la lecture de cache à tarif réduit' },
  { key: 'context', label: 'Context window', icon: '📚', desc: 'Fenêtre de contexte maximale (jusqu\'à 1M+ tokens)' },
  { key: 'tools', label: 'Support Tool Calls', icon: '🛠️', desc: 'Appel natif de fonctions et outils externes (API, Bash, etc.)' },
  { key: 'has_vision', label: 'Support Vision (Multimodal)', icon: '👁️', desc: 'Capacité à traiter les images, captures d\'écran et diagrammes' },
  { key: 'languages', label: 'Langues cibles', icon: '🌐', desc: 'Couverture des langues définies (champ texte ci-dessous) par le modèle' },
  { key: 'open_weights', label: 'Open-weights (Poids ouverts)', icon: '🔓', desc: 'Modèles open-weights téléchargeables (Hugging Face)' },
  { key: 'fits_64gb', label: 'Local VRAM ≤ 64GB', icon: '🖥️', desc: 'Faisabilité d\'exécution locale sur GPU standard (≤ 64GB)' },
  { key: 'tools_vision', label: 'Tools + Vision (QA Playwright)', icon: '🎯', desc: 'Bonus combiné si le modèle gère à la fois les Tools et la Vision' },
] as const

const DEFAULT_PROFILES: Record<string, ProfileConfig> = {
  architecte: {
    id: 'architecte',
    name: 'Architecte',
    weights: { intelligence: 5, coding: 4, context: 3, price_in: 2, price_out: 2, has_vision: 1 }
  },
  'senior-coder': {
    id: 'senior-coder',
    name: 'Senior Coder',
    weights: { coding: 5, agentic: 5, price_out: 3, context: 3, has_vision: 2, intelligence: 2 }
  },
  'junior-coder': {
    id: 'junior-coder',
    name: 'Junior Coder',
    weights: { price_out: 5, open_weights: 4, price_in: 3, fits_64gb: 3, tools: 2, coding: 2 }
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    weights: { price_in: 5, intelligence: 4, price_out: 3, tools: 3, context: 3 }
  },
  qa: {
    id: 'qa',
    name: 'QA',
    weights: { tools_vision: 5, coding: 4, price_out: 4, intelligence: 3, context: 2, agentic: 1 }
  }
}

// ---- Helpers --------------------------------------------------
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return '…'
  if (v === 0) return '$0'
  return '$' + v.toFixed(2) + '/M tk'
}
function fmtIdx(v: number | null | undefined): string {
  if (v == null) return '…'
  return v.toFixed(1)
}

function modelSafeKey(m: string): string {
  return m.replace(/[^a-zA-Z0-9_]/g, '_')
}

function fmtTok(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  return v.toLocaleString()
}

function fmtCtx(v: number | null | undefined): string {
  if (!v) return '?'
  if (v >= 1000000) {
    const millions = v / 1000000
    return v % 1000000 === 0 ? `${millions}M` : `+${Math.floor(millions)}M`
  }
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return `${v}`
}

function buildModelTooltip(m: any): string {
  const inMod = (m.input_modalities && m.input_modalities.length > 0)
    ? m.input_modalities.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
    : (m.has_vision ? 'Text, Image' : 'Text')
  const outMod = (m.output_modalities && m.output_modalities.length > 0)
    ? m.output_modalities.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
    : 'Text'

  const lines = [
    `Modèle : ${m.label || m.name || m.id}`,
    `Contexte max : ${(m.context_length || 0).toLocaleString()} tokens (${fmtCtx(m.context_length)})`,
    `Prix Input : ${fmtPrice(m.prompt_price)}`,
    `Prix Output : ${fmtPrice(m.completion_price)}`,
  ]
  if (m.cache_read_price != null) lines.push(`Cache Read : ${fmtPrice(m.cache_read_price)}`)
  if (m.cache_write_price != null) lines.push(`Cache Write : ${fmtPrice(m.cache_write_price)}`)
  if (m.web_search_price != null) lines.push(`Web Search : $${m.web_search_price}/1k req`)
  if (m.internal_reasoning_price != null) lines.push(`Reasoning Tokens : ${fmtPrice(m.internal_reasoning_price)}`)
  
  lines.push(`Modalités : Input: [${inMod}] → Output: [${outMod}]`)
  return lines.join("\n")
}

function fmtDate(ts: number | undefined): string {
  if (!ts) return '–'
  return new Date(ts * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ---- Provider icons -------------------------------------------
const providerIcons: Record<string, string> = {
  anthropic: '🅐', openai: '🅞', google: '🅖', deepseek: '🅓',
  qwen: '🅠', moonshotai: '🌙', mistralai: 'Ⓜ', meta: '⬡',
  nvidia: '🅝', amazon: '🅐', cohere: '🅒', xai: '✕',
}
function providerIcon(id: string): string {
  for (const [k, v] of Object.entries(providerIcons)) if (id.split('/')[0].includes(k)) return v
  return '🤖'
}
function providerName(id: string): string {
  const p = id.split('/')[0]
  for (const k of Object.keys(providerIcons)) if (p.includes(k)) return k.charAt(0).toUpperCase() + k.slice(1)
  return p
}

// ---- Colors ----------------------------------------------------
const colors = [
  'var(--ui-purple)', '#82ca9d', '#ffc658', 'var(--ui-orange)', '#00C49F', '#0088FE', '#FFBB28', '#FF8042',
  '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1', 'var(--ui-red)', '#ba68c8', '#4db6ac', 'var(--ui-bg-editor)176'
]

// ---- Generic Scoring Algorithm (impl in src/core/scoring.ts) ----
// ---- Styles (Hermes Desktop look & feel) -----------------------
const S = {
  wrap: { fontFamily: 'var(--dt-font-sans)', color: 'var(--ui-text-primary)', padding: '8px 14px' } as const,
  flexRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' } as const,
  gap: { display: 'flex', gap: 8, alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 } as const,
  th: { textAlign: 'left' as const, padding: '6px 8px', background: 'var(--ui-bg-tertiary)', borderBottom: '2px solid var(--ui-stroke-primary)', whiteSpace: 'nowrap' as const, color: 'var(--ui-text-secondary)', fontWeight: 700 },
  trEven: { background: 'var(--ui-bg-editor)' } as const,
  trOdd: { background: 'var(--ui-row-hover-background)' } as const,
  td: { padding: '5px 8px', borderBottom: '1px solid var(--ui-stroke-tertiary)' } as const,
  searchRow: { padding: '6px 10px', borderBottom: '1px solid var(--ui-stroke-tertiary)', fontSize: 13 } as const,
  tabBtn: (active: boolean) => ({
    padding: '8px 18px',
    border: 'none',
    borderBottom: active ? '3px solid var(--ui-accent)' : '3px solid transparent',
    background: 'none',
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--ui-accent-secondary)' : 'var(--ui-text-tertiary)',
    cursor: 'pointer',
    fontSize: 15,
  }) as const,
  card: {
    background: 'var(--ui-bg-editor)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    border: '1px solid var(--ui-stroke-tertiary)',
    flex: 1,
    minWidth: 200,
    boxShadow: 'var(--shadow-sm)',
  } as const,
  iconBtn: {
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--ui-stroke-secondary)',
    background: 'var(--ui-bg-editor)',
    color: 'var(--ui-text-secondary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    transition: 'all 0.15s ease',
  } as const,
}

// ---- Main --------------------------------------------------
export default function App() {
  const i18n = useLeaderboardI18n()

  // Profiles state
  const [hermesProfiles, setHermesProfiles] = useState<string[]>([])
  const [serverProfiles, setServerProfiles] = useState<Record<string, ProfileConfig>>(DEFAULT_PROFILES)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('architecte')
  const [editingProfile, setEditingProfile] = useState<ProfileConfig | null>(null)
  const [isNewProfile, setIsNewProfile] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Models state
  const [models, setModels] = useState<ModelRecord[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [radarHidden, setRadarHidden] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [searchRes, setSearchRes] = useState<SearchHit[]>([])
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  // News sidebar state
  const [showNews, setShowNews] = useState(true)
  const [news, setNews] = useState<NewsData | null>(null)
  const [loadingNews, setLoadingNews] = useState(false)
  const [newsSortBy, setNewsSortBy] = useState<NewsSortBy>('date')
  const [newsTimeWindow, setNewsTimeWindow] = useState<NewsTimeWindow>('1m')
  const [newsVisibleLimit, setNewsVisibleLimit] = useState(8)

  // Load persistent UI state & LocalStorage profiles
  useEffect(() => {
    const raw = localStorage.getItem('llm-dash-hidden')
    if (raw) setHiddenIds(new Set(JSON.parse(raw)))
    const rawRadar = localStorage.getItem('llm-dash-radar-hidden')
    if (rawRadar) setRadarHidden(new Set(JSON.parse(rawRadar)))
    const rawProfile = localStorage.getItem('llm-dash-profile')
    if (rawProfile) setSelectedProfileId(rawProfile)
    const rawNews = localStorage.getItem('llm-dash-show-news')
    if (rawNews !== null) setShowNews(rawNews === 'true')

  }, [])

  // Fetch profiles from backend
  const fetchProfiles = () => {
    api('/profiles')
      
      .then(data => {
        if (data.profiles && Object.keys(data.profiles).length > 0) {
          setServerProfiles(data.profiles)
        }
      })
      .catch(() => {})
  }
  useEffect(() => { fetchProfiles() }, [])

  // Active profiles: server-side persistence only (the plugin runs in the
  // authenticated Hermes context).
  const effectiveProfiles: Record<string, ProfileConfig> = serverProfiles

  const currentProfile = useMemo(() => {
    return effectiveProfiles[selectedProfileId] || effectiveProfiles['architecte'] || Object.values(effectiveProfiles)[0] || {
      id: selectedProfileId,
      name: selectedProfileId,
      weights: { intelligence: 5, coding: 4, context: 3, price_in: 2, price_out: 2 }
    }
  }, [effectiveProfiles, selectedProfileId])

  const toggleNews = () => {
    setShowNews(prev => {
      const next = !prev
      localStorage.setItem('llm-dash-show-news', String(next))
      return next
    })
  }

  const toggleHidden = (id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem('llm-dash-hidden', JSON.stringify([...next]))
      return next
    })
  }
  const toggleRadar = (label: string) => {
    setRadarHidden(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label); else next.add(label)
      localStorage.setItem('llm-dash-radar-hidden', JSON.stringify([...next]))
      return next
    })
  }

  const fetchModels = () => {
    setLoading(true)
    api('/models').then(d => setModels(d.models)).finally(() => setLoading(false))
  }
  useEffect(() => { fetchModels() }, [])
  useEffect(() => { api('/hermes-profiles').then(d => setHermesProfiles(d.profiles || ['default'])).catch(() => setHermesProfiles(['default'])) }, [])

  const fetchNews = () => {
    setLoadingNews(true)
    api('/news').then(d => setNews(d)).finally(() => setLoadingNews(false))
  }
  useEffect(() => { fetchNews() }, [])

  const refresh = () => {
    setLoading(true)
    api('/refresh', { method: 'POST' })
      .then(d => setModels(d.models))
      .finally(() => {
        setLoading(false)
        fetchNews()
      })
  }

  const addModel = (id: string) => {
    setAdding(true)
    api('/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then(() => {
      fetchModels()
      fetchNews()
      setQ('')
      setSearchRes([])
    }).finally(() => setAdding(false))
  }

  const removeModel = (id: string) => {
    setConfirmDelete(id)
    if (confirmDelete !== id) setTimeout(() => setConfirmDelete(prev => prev === id ? null : prev), 3000)
  }
  const confirmRemove = (id: string) => {
    setConfirmDelete(null)
    api(`/models/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => {
      fetchModels()
      fetchNews()
    })
  }

  const search = () => {
    api(`/openrouter/search?q=${encodeURIComponent(q)}`)
      .then(d => setSearchRes(d.results || []))
  }

  // ---- Profile Management Handlers ----
  const openEditModal = () => {
    setEditingProfile(JSON.parse(JSON.stringify(currentProfile)))
    setIsNewProfile(false)
    setModalOpen(true)
  }

  const openCreateModal = () => {
    setEditingProfile({
      id: '',
      name: '',
      weights: {
        intelligence: 3,
        coding: 3,
        agentic: 3,
        price_in: 2,
        price_out: 2,
        context: 2,
        tools: 2,
        has_vision: 1,
        open_weights: 0,
        fits_64gb: 0,
        cache_read: 0,
        tools_vision: 0
      }
    })
    setIsNewProfile(true)
    setModalOpen(true)
  }

  const resetToDefaultProfiles = () => {
    if (!confirm(i18n.modal.reset)) return
    setSelectedProfileId('architecte')
    localStorage.setItem('llm-dash-profile', 'architecte')
    setModalOpen(false)
  }

  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillMsg, setAutoFillMsg] = useState('')
  const autoFillCriteria = () => {
    if (!editingProfile || autoFilling) return
    setAutoFilling(true)
    setAutoFillMsg(i18n.modal.autoFillRunning)
    api('/auto-fill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id: editingProfile.id, profile_name: editingProfile.name }) })
      .then((d: any) => {
        const w = d && d.weights ? d.weights : {}
        setEditingProfile((prev: any) => prev ? { ...prev, ...w } : prev)
        setAutoFillMsg(i18n.modal.autoFillDone)
      })
      .catch((err: any) => {
        setAutoFillMsg(`${i18n.modal.autoFillFailed}: ${err && err.message ? err.message : err}`)
      })
      .finally(() => setAutoFilling(false))
  }

  const saveProfileConfig = () => {
    if (!editingProfile) return
    const id = editingProfile.id.trim().toLowerCase()
    if (!id) {
      alert(i18n.modal.needId)
      return
    }

    // Always persist to the backend — the plugin lives inside an authenticated
    // Hermes desktop context, there is no anonymous/local fallback.
    setSavingProfile(true)
    const method = isNewProfile ? 'POST' : 'PUT'
    const url = isNewProfile ? '/api/profiles' : `/api/profiles/${encodeURIComponent(id)}`

    api(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProfile),
    })
      .then(d => d)
      .then(data => {
        if (data.profile) {
          setServerProfiles(prev => ({ ...prev, [data.profile.id]: data.profile }))
          setSelectedProfileId(data.profile.id)
          localStorage.setItem('llm-dash-profile', data.profile.id)
        }
        setModalOpen(false)
      })
      .catch(err => {
        alert(err.message || i18n.modal.saveError)
      })
      .finally(() => setSavingProfile(false))
  }

  const deleteCurrentProfile = () => {
    if (!editingProfile || isNewProfile) return
    const pid = editingProfile.id
    if (!confirm(i18n.modal.deleteConfirm(editingProfile.name))) return

    // Delete from backend
    setSavingProfile(true)
    api(`/profiles/${encodeURIComponent(pid)}`, { method: 'DELETE' })
      .then(() => {
        setServerProfiles(prev => {
          const next = { ...prev }
          delete next[pid]
          return next
        })
        const remaining = Object.keys(effectiveProfiles).filter(k => k !== pid)
        const nextId = remaining[0] || 'architecte'
        setSelectedProfileId(nextId)
        localStorage.setItem('llm-dash-profile', nextId)
        setModalOpen(false)
      })
      .catch(err => alert(err.message || i18n.modal.saveError))
      .finally(() => setSavingProfile(false))
  }

  // Sort
  const sortFns: Record<string, (a: ModelRecord, b: ModelRecord) => number> = {
    label: (a, b) => a.label.localeCompare(b.label),
    context_length: (a, b) => (a.context_length || 0) - (b.context_length || 0),
    prompt_price: (a, b) => (a.prompt_price ?? Infinity) - (b.prompt_price ?? Infinity),
    completion_price: (a, b) => (a.completion_price ?? Infinity) - (b.completion_price ?? Infinity),
    cache_read_price: (a, b) => (a.cache_read_price ?? Infinity) - (b.cache_read_price ?? Infinity),
    intelligence_index: (a, b) => (a.intelligence_index ?? -1) - (b.intelligence_index ?? -1),
    coding_index: (a, b) => (a.coding_index ?? -1) - (b.coding_index ?? -1),
    agentic_index: (a, b) => (a.agentic_index ?? -1) - (b.agentic_index ?? -1),
    open_weights: (a, b) => (a.open_weights ? 1 : 0) - (b.open_weights ? 1 : 0),
    tools: (a, b) => ((a.supported_parameters || []).includes('tools') ? 1 : 0) - ((b.supported_parameters || []).includes('tools') ? 1 : 0),
    has_vision: (a, b) => (a.has_vision ? 1 : 0) - (b.has_vision ? 1 : 0),
  }

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(prev => !prev)
    else { setSortCol(col); setSortAsc(true) }
  }
  const sortArrow = (col: string) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ' ↕'

  // Visible / active
  const visible = models.filter(m => !hiddenIds.has(m.id))
  const hidden = models.filter(m => hiddenIds.has(m.id))
  const active = visible.filter(m => m.available)

  // Maxes for normalization
  const maxes = useMemo(() => ({
    maxCtx: Math.max(1, ...models.map(m => m.context_length || 0)),
    maxPrice: Math.max(0.01, ...models.flatMap(m => [m.prompt_price || 0, m.completion_price || 0])),
    maxPriceIn: Math.max(0.01, ...models.map(m => m.prompt_price || 0)),
    maxPriceOut: Math.max(0.01, ...models.map(m => m.completion_price || 0)),
    maxPriceCache: Math.max(0.01, ...models.map(m => m.cache_read_price || 0)),
    maxIntel: Math.max(1, ...models.map(m => m.intelligence_index || 0)),
    maxCoding: Math.max(1, ...models.map(m => m.coding_index || 0)),
    maxAgentic: Math.max(1, ...models.map(m => m.agentic_index || 0)),
  }), [models])

  // Scores + ranks (using generic scoring algorithm based on currentProfile.weights)
  const scoredModels = useMemo(() => {
    const withScores = active.map(m => ({
      ...m,
      _score: Math.round(computeGenericScore(m, currentProfile.weights, maxes, currentProfile.targetLangs) * 100) / 100,
    }))
    withScores.sort((a, b) => b._score - a._score)
    withScores.forEach((m, i) => { (m as any)._rank = i + 1 })
    return withScores
  }, [active, currentProfile, maxes])

  // Threshold: rounded score to qualify as top challenger
  const top3Threshold = useMemo(() => {
    if (scoredModels.length < 3) return 0
    const rank3Score = Math.round(scoredModels[2]._score)
    const rank4Score = scoredModels.length >= 4 ? Math.round(scoredModels[3]._score) : rank3Score
    return Math.min(rank3Score, rank4Score)
  }, [scoredModels])

  const scoreMap: Record<string, number> = {}
  scoredModels.forEach(m => { scoreMap[m.id] = (m as any)._score })

  const sortedModels = useMemo(() => {
    if (sortCol && sortFns[sortCol]) {
      const sorted = [...models].sort(sortFns[sortCol])
      return sortAsc ? sorted : sorted.reverse()
    }
    // Default: sort by score (best first)
    return [...models].sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0))
  }, [models, sortCol, sortAsc, scoreMap])

  // ---- Filtered & Sorted New Models for Sidebar ----
  const processedNewModels = useMemo(() => {
    if (!news?.new_models) return []
    
    // 1. Time window filter
    const nowTs = Math.floor(Date.now() / 1000)
    const windowDays = newsTimeWindow === '1m' ? 30 : newsTimeWindow === '2m' ? 60 : newsTimeWindow === '3m' ? 90 : newsTimeWindow === '6m' ? 180 : newsTimeWindow === '1y' ? 365 : 99999
    const minCreated = nowTs - (windowDays * 86400)

    const list = news.new_models
      .filter(nm => (nm.created || 0) >= minCreated)
      .map(nm => {
        const rawScore = computeGenericScore(nm, currentProfile.weights, maxes, currentProfile.targetLangs)
        const roundedScore = Math.round(rawScore)
        const isChallenger = roundedScore > 0 && top3Threshold > 0 && roundedScore >= top3Threshold
        return {
          ...nm,
          _score: rawScore,
          _roundedScore: roundedScore,
          _isChallenger: isChallenger,
        }
      })

    // 2. Sort
    if (newsSortBy === 'score') {
      list.sort((a, b) => b._score - a._score)
    } else {
      list.sort((a, b) => (b.created || 0) - (a.created || 0))
    }

    return list
  }, [news?.new_models, newsTimeWindow, newsSortBy, currentProfile, maxes, top3Threshold])

  // ---- Processed Promotions for Sidebar ----
  const processedPromotions = useMemo(() => {
    if (!news?.promotions) return []
    return news.promotions.map(p => {
      const rawScore = computeGenericScore(p, currentProfile.weights, maxes, currentProfile.targetLangs)
      const roundedScore = Math.round(rawScore)
      const isChallenger = roundedScore > 0 && top3Threshold > 0 && roundedScore >= top3Threshold
      return {
        ...p,
        _score: rawScore,
        _roundedScore: roundedScore,
        _isChallenger: isChallenger,
      }
    })
  }, [news?.promotions, currentProfile, maxes, top3Threshold])

  // ---- Radar dynamique basé sur les critères actifs du profil (poids > 0) ----
  const radarData = useMemo(() => {
    if (active.length < 2) return []
    const maxCtx = maxes.maxCtx
    const maxPP = Math.max(0.01, ...active.map(m => m.prompt_price || 0))
    const maxCP = Math.max(0.01, ...active.map(m => m.completion_price || 0))
    const maxCache = Math.max(0.01, ...active.map(m => m.cache_read_price || 0))

    const criteriaDefinitions: { key: string; label: string; getValue: (m: ModelRecord) => number }[] = [
      { key: 'intelligence', label: 'Intelligence', getValue: m => ((m.intelligence_index ?? 0) / maxes.maxIntel) * 100 },
      { key: 'coding', label: 'Coding', getValue: m => ((m.coding_index ?? 0) / maxes.maxCoding) * 100 },
      { key: 'agentic', label: 'Agentic', getValue: m => ((m.agentic_index ?? 0) / maxes.maxAgentic) * 100 },
      { key: 'price_in', label: 'Prix↓input', getValue: m => maxPP > 0 ? (1 - (m.prompt_price || 0) / maxPP) * 100 : 100 },
      { key: 'price_out', label: 'Prix↓output', getValue: m => maxCP > 0 ? (1 - (m.completion_price || 0) / maxCP) * 100 : 100 },
      { key: 'cache_read', label: 'Prix↓cache', getValue: m => maxCache > 0 ? (1 - (m.cache_read_price || 0) / maxCache) * 100 : 100 },
      { key: 'context', label: i18n.table.context, getValue: m => ((m.context_length || 0) / maxCtx) * 100 },
      { key: 'tools', label: 'Tool Calls', getValue: m => (m.supported_parameters || []).includes('tools') ? 100 : 0 },
      { key: 'has_vision', label: 'Vision', getValue: m => m.has_vision ? 100 : 0 },
      { key: 'languages', label: i18n.table.langs, getValue: m => {
        const targets = parseTargetLangs(currentProfile.targetLangs || 'en, fr')
        if (targets.length === 0) return 0
        const ml = (m.iso_langs || []).map(l => l.toLowerCase())
        return (targets.filter(t => ml.includes(t)).length / targets.length) * 100
      } },
      { key: 'open_weights', label: 'Open weight', getValue: m => m.open_weights ? 100 : 0 },
      { key: 'fits_64gb', label: 'VRAM ≤ 64G', getValue: m => m.gpu?.fits_64gb ? 100 : 0 },
      { key: 'tools_vision', label: 'Tools+Vision', getValue: m => ((m.supported_parameters || []).includes('tools') && m.has_vision) ? 100 : 0 },
    ]

    const activeCriteria = criteriaDefinitions.filter(c => (currentProfile.weights[c.key] ?? 0) > 0)
    const finalCriteria = activeCriteria.length > 0 ? activeCriteria : criteriaDefinitions.slice(0, 5)

    return finalCriteria.map(crit => {
      const entry: any = { label: crit.label }
      for (const m of active) {
        entry[m.label] = crit.getValue(m)
      }
      return entry
    })
  }, [active, maxes, currentProfile.weights])

  const allLabels = active.map(m => m.label)
  const colorByLabel: Record<string, number> = {}
  allLabels.forEach((l, i) => { colorByLabel[l] = i })
  const activeLabels = allLabels.filter(l => !radarHidden.has(l))

  // Sorted datasets
  const byPriceIn = [...active].sort((a, b) => (a.prompt_price ?? 0) - (b.prompt_price ?? 0))
  const byPriceOut = [...active].sort((a, b) => (a.completion_price ?? 0) - (b.completion_price ?? 0))
  const byCtx = [...active].sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))

  // ---- RENDER --------------------------------------------------
  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ marginBottom: 4, marginTop: 0, color: 'var(--ui-text-primary)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{i18n.title}</h1>
          <p style={{ color: 'var(--ui-text-tertiary)', fontSize: 13, marginTop: 0 }}>
            {i18n.subtitle}
          </p>
        </div>

      </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {/* ---- MAIN COLUMN ---- */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* ---- ACTIONS ---- */}
            <div style={{ ...S.flexRow, marginBottom: 16 }}>
              <div style={S.gap}>
                <button onClick={refresh} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)', background: 'var(--ui-bg-editor)', cursor: 'pointer', fontWeight: 600 }}>{i18n.refresh}</button>
                <span style={{ color: 'var(--ui-text-tertiary)', fontSize: 13 }}>
                  {i18n.nVisible(visible.length, hidden.length > 0 ? i18n.nHidden(hidden.length) : '')}
                </span>
              </div>

              {/* Applies-to profile chips (mirrors Hermes settings) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>{i18n.appliesTo}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(hermesProfiles.length ? hermesProfiles : ['default']).map(name => {
                    const active = name === selectedProfileId
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          setSelectedProfileId(name)
                          localStorage.setItem('llm-dash-profile', name)
                          setSortCol(null)
                        }}
                        style={{
                          borderRadius: 999, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                          border: `1px solid ${active ? 'var(--ui-stroke-secondary)' : 'var(--ui-stroke-tertiary)'}`,
                          background: active ? 'var(--ui-bg-tertiary)' : 'var(--ui-bg-editor)',
                          color: active ? 'var(--ui-text-primary)' : 'var(--ui-text-tertiary)'
                        }}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Search & News Trigger */}
              <div style={S.gap}>
                <input
                  placeholder={i18n.searchPlaceholder}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  style={{ width: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)', fontSize: 13 }}
                />
                <button
                  onClick={search}
                  disabled={adding}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)', background: 'var(--ui-bg-editor)', cursor: 'pointer', fontWeight: 600 }}
                >
                  {i18n.search}
                </button>
                {!showNews && (
                  <button
                    onClick={toggleNews}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--ui-accent-secondary)',
                      background: 'var(--ui-bg-editor)',
                      color: 'var(--ui-accent-secondary)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      marginLeft: 4,
                    }}
                  >
                    📰 Actualités ▶
                  </button>
                )}
              </div>
            </div>

            {/* ---- RÉSULTATS RECHERCHE ---- */}
            {searchRes.length > 0 && (
              <div style={{ background: 'var(--ui-row-hover-background)', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid var(--ui-stroke-tertiary)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--ui-text-secondary)' }}>{i18n.results(searchRes.length)}</h3>
                {searchRes.map((s, i) => (
                  <div key={s.id} style={{ ...S.searchRow, background: i % 2 === 0 ? 'var(--ui-bg-editor)' : 'var(--ui-row-hover-background)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b>{s.name || s.id}</b>
                      <span style={{ color: 'var(--ui-text-tertiary)', marginLeft: 8 }}>{fmtPrice(s.prompt_price)} in / {fmtPrice(s.completion_price)} out · ctx: {(s.context_length || 0).toLocaleString()}</span>
                      {s.has_vision && <span style={{ marginLeft: 6, background: 'color-mix(in srgb, var(--ui-blue) 8%, transparent)', color: 'var(--ui-blue)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>👁</span>}
                      {s.open_weights && <span style={{ marginLeft: 4, background: 'color-mix(in srgb, var(--ui-green) 12%, transparent)', color: 'var(--ui-green)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>open</span>}
                      {s.model_size && <span style={{ marginLeft: 4, color: 'var(--ui-text-tertiary)', fontSize: 11 }}>{s.model_size}</span>}
                    </div>
                    <button onClick={() => addModel(s.id)} disabled={adding || models.some(m => m.id === s.id)} style={{ minWidth: 100, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--ui-stroke-secondary)', cursor: 'pointer' }}>
                      {models.some(m => m.id === s.id) ? i18n.alreadyTracked : i18n.add}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {loading ? (<p>{i18n.loading}</p>) : (
              <>
                {/* ---- CLASSEMENT ---- */}
                <div style={{ marginBottom: 24, padding: 16, background: 'var(--ui-row-hover-background)', borderRadius: 8, border: '1px solid var(--ui-stroke-tertiary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, color: 'var(--ui-text-primary)' }}>{i18n.ranking(currentProfile.name)}</h3>
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--ui-text-tertiary)' }}>{i18n.customCriteria}</span>
                      <button
                        onClick={openEditModal}
                        style={{ border: 'none', background: 'transparent', color: 'var(--ui-accent)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}
                      >
                        {i18n.editCriteria}
                      </button>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {scoredModels.slice(0, 5).map((m: any) => (
                      <div
                        key={m.id}
                        title={buildModelTooltip(m)}
                        style={{
                          flex: 1, minWidth: 160, padding: 10,
                          background: m._rank === 1 ? 'var(--ui-bg-editor)7ed' : m._rank === 2 ? 'var(--ui-row-hover-background)' : 'var(--ui-bg-editor)',
                          borderRadius: 6,
                          border: m._rank <= 3 ? '2px solid var(--ui-orange)' : '1px solid var(--ui-stroke-tertiary)',
                          cursor: 'help',
                          transition: 'transform 0.1s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{m._rank === 1 ? '🥇' : m._rank === 2 ? '🥈' : m._rank === 3 ? '🥉' : `#${m._rank}`} {providerIcon(m.id)} {m.label}</span>
                          <span style={{ fontSize: 10, background: 'var(--ui-bg-tertiary)', padding: '1px 4px', borderRadius: 3, color: 'var(--ui-text-secondary)' }}>{fmtCtx(m.context_length)}</span>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ui-orange)', marginTop: 2 }}>{m._score.toFixed(0)}/100</div>
                        <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                          <span>in:{fmtPrice(m.prompt_price)}</span>
                          <span>out:{fmtPrice(m.completion_price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

{/* ---- TABLEAU ---- */}
                <div style={{ overflowX: 'auto', marginBottom: 24, border: '1px solid var(--ui-stroke-tertiary)', borderRadius: 8 }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}></th>
                        <th style={{ ...S.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('label')}>{i18n.table.model}{sortArrow('label')}</th>
                        <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('context_length')}>{i18n.table.context}{sortArrow('context_length')}</th>
                        <th style={{ ...S.th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('prompt_price')}>$ in{sortArrow('prompt_price')}</th>
                        <th style={{ ...S.th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('completion_price')}>$ out{sortArrow('completion_price')}</th>
                        <th style={{ ...S.th, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('cache_read_price')}>$ cache{sortArrow('cache_read_price')}</th>
                        <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('intelligence_index')}>Intel.{sortArrow('intelligence_index')}</th>
                        <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('coding_index')}>Coding{sortArrow('coding_index')}</th>
                        <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('agentic_index')}>Agentic{sortArrow('agentic_index')}</th>
                        <th style={{ ...S.th, textAlign: 'center' }}>SWE</th>
                        <th style={{ ...S.th, textAlign: 'center' }}>Aider</th>
                        <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('has_vision')}>Vision{sortArrow('has_vision')}</th>
                        <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('open_weights')}>Open{sortArrow('open_weights')}</th>
                        <th style={{ ...S.th, textAlign: 'center' }}>Taille</th>
                        <th style={{ ...S.th, textAlign: 'center' }}>GPU Q4</th>
                        <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('tools')}>Tools{sortArrow('tools')}</th>
                        <th style={{ ...S.th, textAlign: 'center' }} title="Langues (ISO 639-1)">Langues</th>
                        <th style={{ ...S.th, textAlign: 'center' }} title={`Score ${currentProfile.name}`}>⭐</th>
                        <th style={S.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedModels.map((m, i) => {
                        const sc = scoreMap[m.id]
                        const rank = scoredModels.findIndex(sm => sm.id === m.id)
                        const rankStr = rank >= 0 ? `#${rank + 1}` : '-'
                        const top3 = rank >= 0 && rank < 3
                        return (
                          <tr key={m.id} style={{ ...(i % 2 === 0 ? S.trEven : S.trOdd), opacity: hiddenIds.has(m.id) ? 0.35 : m.available ? 1 : 0.4 }}>
                            <td style={{ ...S.td, textAlign: 'center', fontSize: 16 }} title={providerName(m.id)}>{providerIcon(m.id)}</td>
                            <td style={S.td}>
                              <b>{m.label}</b>
                              <div style={{ fontSize: 10, color: 'var(--ui-text-tertiary)' }}>{m.id}</div>
                            </td>
                            <td style={{ ...S.td, textAlign: 'right' }} title={`${(m.context_length || 0).toLocaleString()} tokens`}>
                              {fmtCtx(m.context_length)}
                            </td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmtPrice(m.prompt_price)}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmtPrice(m.completion_price)}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: m.cache_read_price ? 'var(--ui-blue)' : 'var(--ui-text-quaternary)' }}>
                              {m.cache_read_price != null ? fmtPrice(m.cache_read_price) : '–'}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{fmtIdx(m.intelligence_index)}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{fmtIdx(m.coding_index)}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{fmtIdx(m.agentic_index)}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{m.benchmarks?.swebench_verified != null ? m.benchmarks.swebench_verified + '%' : '…'}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{m.benchmarks?.aider_polyglot != null ? m.benchmarks.aider_polyglot + '%' : '…'}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{m.has_vision ? '👁' : ''}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{m.open_weights ? '✅' : '❌'}</td>
                            <td style={{ ...S.td, textAlign: 'center', fontSize: 11 }}>{m.model_size || '?'}</td>
                            <td style={{ ...S.td, textAlign: 'center', fontSize: 11 }}>
                              {m.gpu ? <span title={`Q8: ${m.gpu.vram_q8_gb}GB, FP16: ${m.gpu.vram_fp16_gb}GB`}>{m.gpu.vram_q4_gb}GB{m.gpu.fits_64gb ? ' ✓' : ''}</span> : '-'}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center' }}>{(m.supported_parameters || []).includes('tools') ? '✅' : '❌'}</td>
                            <td style={{ ...S.td, textAlign: 'center', fontSize: 11 }} title={(m.iso_langs || []).length ? `Langues: ${(m.iso_langs || []).join(', ')}` : 'Langues non spécifiées'}>
                              {(m.iso_langs || []).length > 0 ? `${(m.iso_langs || []).length} 🌐` : '–'}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, background: top3 ? 'var(--ui-bg-editor)3e0' : undefined }}>
                              <span title={`Score ${currentProfile.name}: ${sc}`} style={{ color: top3 ? 'var(--ui-orange)' : sc > 50 ? 'var(--ui-green)' : 'var(--ui-text-tertiary)' }}>
                                {rankStr}
                                {top3 && <span style={{ fontSize: 10, marginLeft: 2 }}>🥇</span>}
                              </span>
                              <div style={{ fontSize: 10, color: 'var(--ui-text-quaternary)' }}>{sc != null ? `${Math.round(sc)}` : ''}</div>
                            </td>
                            <td style={{ ...S.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                              <button
                                onClick={() => toggleHidden(m.id)}
                                title={hiddenIds.has(m.id) ? 'Afficher' : 'Masquer'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: 13, marginRight: 4 }}
                              >
                                {hiddenIds.has(m.id) ? '👁' : '👁‍🗨'}
                              </button>
                              {confirmDelete === m.id ? (
                                <button
                                  onClick={() => confirmRemove(m.id)}
                                  style={{ background: 'var(--ui-red)', color: 'var(--ui-bg-editor)', border: 'none', borderRadius: 3, padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}
                                >
                                  Suppr?
                                </button>
                              ) : (
                                <button
                                  onClick={() => removeModel(m.id)}
                                  title="Supprimer le modèle"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, fontSize: 12 }}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ---- GRAPHIQUES ---- */}
                {active.length >= 2 && (
                  <>
                    <h2 style={{ marginTop: 32, color: 'var(--ui-text-primary)' }}>Prix ($ / million tokens)</h2>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 360 }}>
                        <h3 style={{ fontSize: 14, color: 'var(--ui-text-tertiary)' }}>Input (moins cher d'abord)</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={byPriceIn}><XAxis dataKey="label" fontSize={11} /><Tooltip formatter={(v: any) => fmtPrice(v)} /><Bar dataKey="prompt_price" fill="var(--ui-purple)" name="$ / M tokens" isAnimationActive={false} /></BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, minWidth: 360 }}>
                        <h3 style={{ fontSize: 14, color: 'var(--ui-text-tertiary)' }}>Output (moins cher d'abord)</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={byPriceOut}><XAxis dataKey="label" fontSize={11} /><Tooltip formatter={(v: any) => fmtPrice(v)} /><Bar dataKey="completion_price" fill="#82ca9d" name="$ / M tokens" isAnimationActive={false} /></BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <h2 style={{ marginTop: 32, color: 'var(--ui-text-primary)' }}>Benchmarks Intelligence (Artificial Analysis)</h2>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {([
                        { k: 'intelligence_index', label: 'Intelligence', color: 'var(--ui-purple)' },
                        { k: 'coding_index', label: 'Coding', color: '#82ca9d' },
                        { k: 'agentic_index', label: 'Agentic', color: 'var(--ui-orange)' },
                      ] as const).map(bm => {
                        const sorted = [...active].filter(m => m[bm.k] != null).sort((a, b) => (b[bm.k] ?? 0) - (a[bm.k] ?? 0))
                        return (
                          <div key={bm.k} style={{ flex: 1, minWidth: 260 }}>
                            <h3 style={{ fontSize: 14, color: 'var(--ui-text-tertiary)' }}>{bm.label}</h3>
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart data={sorted}><XAxis dataKey="label" fontSize={11} /><Tooltip /><Bar dataKey={bm.k} fill={bm.color} name={bm.label} isAnimationActive={false} /></BarChart>
                            </ResponsiveContainer>
                          </div>
                        )
                      })}
                    </div>

                    <h2 style={{ marginTop: 32, color: 'var(--ui-text-primary)' }}>Contexte (tokens)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={byCtx} layout="vertical">
                        <XAxis type="number" fontSize={11} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                        <YAxis type="category" dataKey="label" fontSize={11} width={130} />
                        <Tooltip formatter={(v: any) => v.toLocaleString() + ' tokens'} />
                        <Bar dataKey="context_length" fill="#ffc658" name="Contexte" isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>

                    <h2 style={{ marginTop: 32, color: 'var(--ui-text-primary)' }}>Radar comparatif ({currentProfile.name}) (0–100)</h2>
                    <ResponsiveContainer width="100%" height={450}>
                      <RadarChart data={radarData}>
                        <PolarGrid /><PolarAngleAxis dataKey="label" fontSize={11} /><PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                        {activeLabels.map(label => {
                          const ci = colorByLabel[label] ?? 0
                          return <Radar key={label} dataKey={label} stroke={colors[ci % colors.length]} fill={colors[ci % colors.length]} fillOpacity={0.12} isAnimationActive={false} />
                        })}
                      </RadarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      {allLabels.map(label => {
                        const ci2 = colorByLabel[label] ?? 0
                        const hiddenR = radarHidden.has(label)
                        return (
                          <span key={label} onClick={() => toggleRadar(label)}
                            title={hiddenR ? 'Cliquer pour afficher' : 'Cliquer pour masquer'}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, userSelect: 'none', opacity: hiddenR ? 0.35 : 1, textDecoration: hiddenR ? 'line-through' : 'none', padding: '2px 5px', borderRadius: 4, background: hiddenR ? 'transparent' : colors[ci2 % colors.length] + '18' }}>
                            <span style={{ display: 'inline-block', width: 9, height: 9, background: colors[ci2 % colors.length], borderRadius: 2 }} />
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* ---- VOLET ACTUALITÉS (DROITE) — composant NewsPanel redimensionnable ---- */}
          {showNews && (
            <NewsPanel
              news={news}
              loading={loadingNews}
              onClose={toggleNews}
              processedPromotions={processedPromotions}
              processedNewModels={processedNewModels}
              newsVisibleLimit={newsVisibleLimit}
              setNewsVisibleLimit={setNewsVisibleLimit}
              newsSortBy={newsSortBy}
              setNewsSortBy={setNewsSortBy}
              newsTimeWindow={newsTimeWindow}
              setNewsTimeWindow={setNewsTimeWindow}
              addModel={addModel}
              trackedIds={new Set(models.filter(m => m.available).map(m => m.id))}
              profileName={currentProfile.name}
              fmtDate={fmtDate}
              fmtCtx={fmtCtx}
              fmtPrice={fmtPrice}
            />
          )}
        </div>

      {/* ---- MODAL CONFIGURATION DU PROFIL (Look Hermes Desktop) ---- */}
      {modalOpen && editingProfile && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--ui-bg-editor)',
            borderRadius: 12,
            width: '100%',
            maxWidth: 620,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--ui-stroke-tertiary)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--ui-stroke-tertiary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--ui-row-hover-background)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ui-text-primary)' }}>
                  {i18n.modal.configTitle(editingProfile.name)}
                </h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    onClick={autoFillCriteria}
                    disabled={autoFilling}
                    title={i18n.modal.autoFillHint}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ui-accent-secondary)', background: 'transparent', color: 'var(--ui-accent)', cursor: autoFilling ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    {i18n.modal.autoFill}
                  </button>
                  {autoFillMsg ? <span style={{ fontSize: 12, color: 'var(--ui-text-tertiary)' }}>{autoFillMsg}</span> : null}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ui-text-quaternary)' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Profile Identity */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
                    Identifiant technique :
                  </label>
                  <input
                    type="text"
                    value={editingProfile.id}
                    disabled={!isNewProfile}
                    placeholder="ex: devops, data-engineer"
                    onChange={e => setEditingProfile({ ...editingProfile, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--ui-stroke-secondary)',
                      background: isNewProfile ? 'var(--ui-bg-editor)' : 'var(--ui-bg-tertiary)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1.5 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
                    Nom affiché :
                  </label>
                  <input
                    type="text"
                    value={editingProfile.name}
                    placeholder="ex: DevOps Specialist"
                    onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--ui-stroke-secondary)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Criteria Sliders */}
              <div style={{ borderTop: '1px solid var(--ui-stroke-tertiary)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ui-text-primary)' }}>Pondération des critères :</span>
                  <span style={{ fontSize: 11, color: 'var(--ui-text-tertiary)' }}>
                    Total poids : <b>{Object.values(editingProfile.weights).reduce((a, b) => a + (b || 0), 0)}</b>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {AVAILABLE_CRITERIA.map(crit => {
                    const currentWeight = editingProfile.weights[crit.key] ?? 0
                    return (
                      <div
                        key={crit.key}
                        style={{
                          background: currentWeight > 0 ? 'var(--ui-row-hover-background)' : 'var(--ui-bg-editor)fff',
                          border: `1px solid ${currentWeight > 0 ? 'var(--ui-stroke-secondary)' : 'var(--ui-bg-tertiary)'}`,
                          borderRadius: 8,
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ width: 28, fontSize: 18, textAlign: 'center' }}>
                          {crit.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: currentWeight > 0 ? 700 : 500, fontSize: 13, color: currentWeight > 0 ? 'var(--ui-text-primary)' : 'var(--ui-text-tertiary)' }}>
                              {(i18n.criteria as any)[crit.key] || crit.label}
                            </span>
                            <span style={{
                              fontWeight: 800,
                              fontSize: 12,
                              background: currentWeight === 0 ? 'var(--ui-bg-tertiary)' : currentWeight >= 4 ? 'var(--ui-accent-secondary)' : 'var(--ui-stroke-tertiary)',
                              color: currentWeight >= 4 ? 'var(--ui-bg-editor)' : currentWeight === 0 ? 'var(--ui-text-quaternary)' : 'var(--ui-text-secondary)',
                              padding: '2px 8px',
                              borderRadius: 12,
                            }}>
                              {currentWeight} / 5
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {(i18n.criteria as any)['d_' + crit.key] || crit.desc}
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={5}
                            step={1}
                            value={currentWeight}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10)
                              setEditingProfile({
                                ...editingProfile,
                                weights: {
                                  ...editingProfile.weights,
                                  [crit.key]: val
                                }
                              })
                            }}
                            style={{
                              width: '100%',
                              marginTop: 6,
                              cursor: 'pointer',
                              accentColor: 'var(--ui-accent-secondary)',
                            }}
                          />
                        </div>
                      {crit.key === 'languages' && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--ui-text-tertiary)', flexShrink: 0 }}>Langues :</span>
                          <input
                            type="text"
                            placeholder="en, fr, de…"
                            value={editingProfile.targetLangs ?? 'en, fr'}
                            onChange={e => setEditingProfile({ ...editingProfile, targetLangs: e.target.value })}
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: '1px solid var(--ui-stroke-secondary)',
                              background: 'var(--ui-bg-editor)',
                              color: 'var(--ui-text-primary)',
                            }}
                          />
                          <span style={{ fontSize: 10, color: 'var(--ui-text-quaternary)' }}>ISO, séparées par virgule</span>
                        </div>
                      )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--ui-stroke-tertiary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--ui-row-hover-background)',
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isNewProfile && (
                  <button
                    onClick={deleteCurrentProfile}
                    disabled={savingProfile}
                    style={{
                      background: 'none',
                      border: '1px solid color-mix(in srgb, var(--ui-red) 12%, transparent)',
                      color: 'var(--ui-red)',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {i18n.modal.delete}
                  </button>
                )}
                <button
                  onClick={resetToDefaultProfiles}
                  title="Réinitialise tous les profils et critères aux valeurs d'origine par défaut"
                  style={{
                    background: 'none',
                    border: '1px solid var(--ui-stroke-secondary)',
                    color: 'var(--ui-text-tertiary)',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  🔄 Réinitialiser défauts
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setModalOpen(false)}
                  disabled={savingProfile}
                  style={{
                    background: 'var(--ui-bg-editor)',
                    border: '1px solid var(--ui-stroke-secondary)',
                    borderRadius: 6,
                    padding: '7px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--ui-text-secondary)',
                  }}
                >
                  {i18n.modal.cancel}
                </button>
                <button
                  onClick={saveProfileConfig}
                  disabled={savingProfile}
                  style={{
                    background: 'var(--ui-accent-secondary)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: 'var(--ui-bg-editor)',
                    boxShadow: '0 1px 3px rgba(118, 36, 244, 0.4)',
                  }}
                >
                  {savingProfile ? i18n.modal.saving : i18n.modal.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
