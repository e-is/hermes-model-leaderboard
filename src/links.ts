import type { CSSProperties } from 'react'

/**
 * Open a URL outside the app.
 *
 * Inside Hermes Desktop the preload bridge (`window.hermesDesktop.openExternal`) hands the
 * URL to the system browser. A plain `<a href target="_blank">` does not work there: the
 * renderer's navigation guard swallows the click, so the link looked dead. The `window.open`
 * fallback only serves the standalone dev page (vite), where the bridge is absent.
 */
export function openExternal(url: string): void {
  const bridge = (window as any).hermesDesktop
  if (bridge && typeof bridge.openExternal === 'function') {
    Promise.resolve(bridge.openExternal(url)).catch(() => {
      /* the main process already logs a failure; nothing useful to show in the card */
    })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** A link that looks like one but is a button, so it can route through the bridge. */
export const linkButtonStyle = (color: string, fontSize = 11): CSSProperties => ({
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontSize,
  color,
  textDecoration: 'underline',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
})
