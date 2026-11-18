import type { CSSProperties } from 'react'

import { hostOpenExternal } from './doors.ts'

/**
 * Open a URL outside the app.
 *
 * The desktop injects `ctx.os.openExternal` at register() time (see doors.ts), which is the
 * SDK route to the system browser. A plain `<a href target="_blank">` does not work there: the
 * renderer's navigation guard swallows the click, so the link looked dead. `window.open` only
 * serves the standalone dev page (vite), where no host is registered.
 */
export function openExternal(url: string): void {
  if (hostOpenExternal(url)) return
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
