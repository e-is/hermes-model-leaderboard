import { useState } from 'react'
import { useResizable } from '../hooks/useResizable'

// ---- Types (shared with App) ----------------------------------
type NewsData = {
  new_models: any[]
  price_changes: any[]
  promotions: any[]
}

type NewsTimeWindow = '1m' | '2m' | '3m' | '6m' | '1y' | 'all'
type NewsSortBy = 'date' | 'score'

interface NewsPanelProps {
  news: NewsData | null
  loading: boolean
  onClose: () => void
  // Promotions
  processedPromotions: any[]
  // New models
  processedNewModels: any[]
  newsVisibleLimit: number
  setNewsVisibleLimit: (fn: (prev: number) => number) => void
  // Filters
  newsSortBy: NewsSortBy
  setNewsSortBy: (v: NewsSortBy) => void
  newsTimeWindow: NewsTimeWindow
  setNewsTimeWindow: (v: NewsTimeWindow) => void
  // Model actions
  addModel: (id: string) => void
  trackedIds: Set<string>
  // Profile
  profileName: string
  // Formatters
  fmtDate: (ts?: number) => string
  fmtCtx: (ctx?: number) => string
  fmtPrice: (p?: number | null) => string
}

export function NewsPanel(props: NewsPanelProps) {
  const {
    news, loading, onClose,
    processedPromotions, processedNewModels,
    newsVisibleLimit, setNewsVisibleLimit,
    newsSortBy, setNewsSortBy,
    newsTimeWindow, setNewsTimeWindow,
    addModel, trackedIds,
    profileName,
    fmtDate, fmtCtx, fmtPrice,
  } = props

  const { width, onMouseDown } = useResizable({
    initial: 360,
    min: 280,
    max: 600,
    storageKey: 'llm-dash-news-width',
  })

  const isTracked = (id: string) => trackedIds.has(id)

  // Price-change alert filters: keep a change when |variation| >= threshold on
  // either the rolling 24h or the rolling 7d window (backend provides both).
  const [priceThreshold, setPriceThreshold] = useState(5)
  const [priceDays, setPriceDays] = useState(7)
  const _nowSec = Date.now() / 1000
  const filteredPriceChanges = (news?.price_changes || []).filter((pc: any) => {
    const withinWindow = (pc.changed_at || 0) >= _nowSec - priceDays * 86400
    const v1 = Math.abs(pc.percent_1d ?? 0)
    const v7 = Math.abs(pc.percent_7d ?? 0)
    return withinWindow && (v1 >= priceThreshold || v7 >= priceThreshold)
  })

  return (
    <>
      {/* Drag handle — sits between main column and news panel.
          The parent flex container has gap: 20; negative margins pull the
          sash flush against both neighbors so no dead space remains. */}
      <div
        onMouseDown={onMouseDown}
        className="news-drag-handle"
        style={{
          width: 10,
          flexShrink: 0,
          cursor: 'col-resize',
          alignSelf: 'stretch',
          // No negative margins: the parent's gap:10 provides the spacing
          zIndex: 10,
          position: 'relative',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
        }}
      >
      {/* Sash — replicates the desktop pane-shell tree-split: a 1px hairline
          at rest (opacity 0.1, recedes into the surface), rising to full on
          hover alongside a 4px soft-accent grab band (see tree-split.tsx). */}
      <span className="news-sash-hairline" />
      <span className="news-sash-hover-band" />
      </div>

      <div
        style={{
          width,
          background: 'var(--ui-bg-editor)',
          border: '1px solid var(--ui-stroke-tertiary)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
          marginLeft: -10,
          // No own scroll, no fixed height: the panel stretches to the height of
          // the main column (the flex container uses alignItems: 'flex-start',
          // so we opt back into stretching with alignSelf) and the page scrolls
          // as one — no double scrollbar.
          alignSelf: 'stretch',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, borderBottom: '1px solid var(--ui-stroke-tertiary)', paddingBottom: 8,
          position: 'sticky', top: -16, background: 'var(--ui-bg-editor)', paddingTop: 4, zIndex: 1,
        }}>
          <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ui-text-primary)' }}>
            📰 Actualités & Nouveautés
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ui-text-tertiary)', fontSize: 14 }} title="Masquer le volet">✕</button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--ui-text-tertiary)' }}>Chargement des actualités…</p>
        ) : !news ? (
          <p style={{ fontSize: 13, color: 'var(--ui-text-tertiary)' }}>Aucune actualité disponible.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Section 1 : Promos ── */}
            {processedPromotions.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ui-red)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  🏷️ Promos en cours
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {processedPromotions.map((p: any) => (
                    <div key={p.id} style={{
                      background: p._isChallenger
                        ? 'color-mix(in srgb, var(--ui-yellow) 8%, var(--ui-bg-editor))'
                        : 'color-mix(in srgb, var(--ui-red) 4%, var(--ui-bg-editor))',
                      border: p._isChallenger
                        ? '1px solid var(--ui-yellow)'
                        : '1px solid color-mix(in srgb, var(--ui-red) 8%, transparent)',
                      borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <b>{p.name}</b>
                          <span style={{ background: 'var(--ui-red)', color: 'var(--ui-bg-editor)', padding: '1px 5px', borderRadius: 3, fontWeight: 700, fontSize: 10 }}>
                            🔻 {p.discount_text}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, color: p._isChallenger ? 'var(--ui-orange)' : 'var(--ui-text-secondary)', fontSize: 12 }}>
                            {p._roundedScore > 0 ? `${p._roundedScore}/100` : '–'}
                          </span>
                          {p._isChallenger && (
                            <div style={{ fontSize: 9, background: 'var(--ui-orange)', color: 'var(--ui-bg-editor)', padding: '1px 4px', borderRadius: 3, fontWeight: 700, marginTop: 1 }}>
                              🔥 Top 3 !
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)', marginTop: 4 }}>{p.details}</div>
                      {p.ends_at ? (
                        <div style={{ fontSize: 10, color: p._isChallenger ? 'var(--ui-orange)' : 'var(--ui-text-tertiary)', marginTop: 2 }}>
                          ⏳ Jusqu'au {p.ends_at}
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <a href={`https://openrouter.ai/${p.id}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: 'var(--ui-accent-secondary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          Détails ↗
                        </a>
                        <button
                          onClick={() => addModel(p.id)}
                          disabled={isTracked(p.id)}
                          style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 4,
                            cursor: isTracked(p.id) ? 'default' : 'pointer', fontWeight: 600,
                            background: isTracked(p.id) ? 'var(--ui-bg-tertiary)' : p._isChallenger ? 'var(--ui-orange)' : 'var(--ui-bg-editor)',
                            border: isTracked(p.id) ? '1px solid var(--ui-stroke-secondary)' : p._isChallenger ? '1px solid var(--ui-orange)' : '1px solid var(--ui-red)',
                            color: isTracked(p.id) ? 'var(--ui-text-quaternary)' : p._isChallenger ? 'var(--ui-bg-editor)' : 'var(--ui-red)',
                            boxShadow: (!isTracked(p.id) && p._isChallenger) ? '0 1px 4px color-mix(in srgb, var(--ui-orange) 40%, transparent)' : 'none',
                          }}
                        >
                          {isTracked(p.id) ? 'Déjà suivi' : '➕ Suivre'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Section 2 : Changements de tarifs ── */}
            {news.price_changes && news.price_changes.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ui-blue)', textTransform: 'uppercase' }}>
                    📉 Changements de tarifs
                  </div>
                  <label style={{ fontSize: 10, color: 'var(--ui-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Seuil ≥
                    <select
                      value={priceThreshold}
                      onChange={e => setPriceThreshold(Number(e.target.value))}
                      style={{ fontSize: 10, padding: '1px 3px', borderRadius: 4, border: '1px solid var(--ui-stroke-secondary)' }}
                    >
                      <option value={1}>1%</option>
                      <option value={5}>5%</option>
                      <option value={10}>10%</option>
                      <option value={25}>25%</option>
                    </select>
                    / 1j ou 7j
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredPriceChanges.map((pc: any) => {
                    const v1 = pc.percent_1d
                    const v7 = pc.percent_7d
                    const pick = v1 != null && Math.abs(v1) >= priceThreshold ? { v: v1, lbl: '24h' } : { v: v7, lbl: '7j' }
                    return (
                    <div key={pc.id} style={{ background: 'var(--ui-bg-tertiary)', border: '1px solid color-mix(in srgb, var(--ui-blue) 10%, transparent)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b>{pc.id.split('/').pop()}</b>
                        <span style={{ color: pick.v <= 0 ? 'var(--ui-green)' : 'var(--ui-red)', fontWeight: 700, fontSize: 11 }}>
                          {pick.v <= 0 ? `🔻 ${pick.v}%` : `🔺 +${pick.v}%`} ({pick.lbl})
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--ui-text-tertiary)' }}>
                          Date : {fmtDate(pc.changed_at)}
                        </span>
                        <a href={`https://openrouter.ai/${pc.id}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: 'var(--ui-blue)', textDecoration: 'underline' }}>
                          Détails ↗
                        </a>
                      </div>
                    </div>
                    )
                  })}
                  {filteredPriceChanges.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)' }}>
                      Aucune variation ≥ {priceThreshold}% sur {priceDays} derniers jours.
                    </div>
                  )}
                  {priceDays < 90 && (
                    <button onClick={() => setPriceDays(prev => prev + 7)} style={{
                      marginTop: 4, padding: '6px 10px', background: 'var(--ui-bg-tertiary)',
                      border: '1px solid var(--ui-stroke-secondary)', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--ui-text-secondary)',
                    }}>
                      ➕ Afficher plus ({priceDays + 7} derniers jours)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Section 3 : Nouveautés & Challengers ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ui-green)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🚀 Nouveautés ({profileName})
                </div>
                <span style={{ fontSize: 11, color: 'var(--ui-text-tertiary)' }}>
                  {processedNewModels.length} modèle{processedNewModels.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Filtres */}
              <div style={{ background: 'var(--ui-row-hover-background)', borderRadius: 'var(--radius-sm)', padding: 6, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, border: '1px solid var(--ui-stroke-tertiary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ui-text-secondary)', fontWeight: 600 }}>Fenêtre :</span>
                  <select
                    value={newsTimeWindow}
                    onChange={e => { setNewsTimeWindow(e.target.value as NewsTimeWindow); setNewsVisibleLimit(() => 8) }}
                    style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--ui-stroke-secondary)' }}
                  >
                    <option value="1m">1 mois (défaut)</option>
                    <option value="2m">2 mois</option>
                    <option value="3m">3 mois</option>
                    <option value="6m">6 mois</option>
                    <option value="1y">1 an</option>
                    <option value="all">Tout</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ui-text-secondary)', fontWeight: 600 }}>Trier par :</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setNewsSortBy('date')} style={{
                      padding: '2px 6px', borderRadius: 4, border: '1px solid var(--ui-stroke-secondary)',
                      background: newsSortBy === 'date' ? 'var(--ui-green)' : 'var(--ui-bg-editor)',
                      color: newsSortBy === 'date' ? 'var(--ui-bg-editor)' : 'var(--ui-text-secondary)',
                      fontWeight: newsSortBy === 'date' ? 700 : 500, cursor: 'pointer', fontSize: 10,
                    }}>📅 Date</button>
                    <button onClick={() => setNewsSortBy('score')} style={{
                      padding: '2px 6px', borderRadius: 4, border: '1px solid var(--ui-stroke-secondary)',
                      background: newsSortBy === 'score' ? 'var(--ui-orange)' : 'var(--ui-bg-editor)',
                      color: newsSortBy === 'score' ? 'var(--ui-bg-editor)' : 'var(--ui-text-secondary)',
                      fontWeight: newsSortBy === 'score' ? 700 : 500, cursor: 'pointer', fontSize: 10,
                    }}>⭐ Score</button>
                  </div>
                </div>
              </div>

              {/* Liste */}
              {processedNewModels.length === 0 ? (
                <p style={{ fontSize: 11, color: 'var(--ui-text-tertiary)', fontStyle: 'italic' }}>Aucune nouveauté sur cette période.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {processedNewModels.slice(0, newsVisibleLimit).map((nm: any) => (
                    <div key={nm.id} style={{
                      background: nm._isChallenger
                        ? 'color-mix(in srgb, var(--ui-yellow) 8%, var(--ui-bg-editor))'
                        : 'var(--ui-row-hover-background)',
                      border: nm._isChallenger ? '1px solid var(--ui-yellow)' : '1px solid var(--ui-stroke-tertiary)',
                      borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <b>{nm.name || nm.id.split('/').pop()}</b>
                          <div style={{ fontSize: 10, color: 'var(--ui-text-tertiary)' }}>{fmtDate(nm.created)} · {fmtCtx(nm.context_length)} ctx</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, color: nm._isChallenger ? 'var(--ui-orange)' : 'var(--ui-text-secondary)', fontSize: 12 }}>
                            {nm._roundedScore > 0 ? `${nm._roundedScore}/100` : '–'}
                          </span>
                          {nm._isChallenger && (
                            <div style={{ fontSize: 9, background: 'var(--ui-orange)', color: 'var(--ui-bg-editor)', padding: '1px 4px', borderRadius: 3, fontWeight: 700, marginTop: 1 }}>
                              🔥 Top 3 !
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{fmtPrice(nm.prompt_price)} / {fmtPrice(nm.completion_price)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <a href={`https://openrouter.ai/${nm.id}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: 11, color: 'var(--ui-accent-secondary)', textDecoration: 'underline' }}>
                            Détails ↗
                          </a>
                          <button
                            onClick={() => addModel(nm.id)}
                            disabled={isTracked(nm.id)}
                            style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 4,
                              cursor: isTracked(nm.id) ? 'default' : 'pointer', fontWeight: 600,
                              background: isTracked(nm.id) ? 'var(--ui-bg-tertiary)' : nm._isChallenger ? 'var(--ui-orange)' : 'var(--ui-bg-editor)',
                              border: isTracked(nm.id) ? '1px solid var(--ui-stroke-secondary)' : nm._isChallenger ? '1px solid var(--ui-orange)' : '1px solid var(--ui-accent-secondary)',
                              color: isTracked(nm.id) ? 'var(--ui-text-quaternary)' : nm._isChallenger ? 'var(--ui-bg-editor)' : 'var(--ui-accent-secondary)',
                              boxShadow: (!isTracked(nm.id) && nm._isChallenger) ? '0 1px 4px color-mix(in srgb, var(--ui-orange) 40%, transparent)' : 'none',
                            }}
                          >
                            {isTracked(nm.id) ? 'Suivi' : '➕ Suivre'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {newsVisibleLimit < processedNewModels.length && (
                    <button onClick={() => setNewsVisibleLimit(prev => prev + 10)} style={{
                      marginTop: 4, padding: '6px 10px', background: 'var(--ui-bg-tertiary)',
                      border: '1px solid var(--ui-stroke-secondary)', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--ui-text-secondary)',
                    }}>
                      ➕ Afficher plus ({processedNewModels.length - newsVisibleLimit} restants)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}