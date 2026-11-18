/**
 * Backend door: the desktop injects ctx.rest at register() time; in standalone
 * dev (demo/vite) we fall back to fetch against /api (proxied).
 */
type RestFn = (path: string, opts?: any) => Promise<any>

let restFn: RestFn | null = null

export function setRest(fn: RestFn | null) {
  restFn = fn
}

export function api(path: string, opts?: any): Promise<any> {
  if (restFn) return restFn(path, opts)
  return fetch(`/api${path}`, opts).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || `HTTP ${r.status}`) })
    return r.json()
  })
}

/**
 * External-link door: the desktop injects `ctx.os.openExternal` at register() time.
 * Standalone dev (vite) has no host, so `window.open` is the fallback there.
 */
type OpenExternalFn = (url: string) => Promise<unknown> | unknown

let openExternalFn: OpenExternalFn | null = null

export function setOpenExternal(fn: OpenExternalFn | null) {
  openExternalFn = fn
}

export function hostOpenExternal(url: string): boolean {
  if (!openExternalFn) return false
  try {
    Promise.resolve(openExternalFn(url)).catch(() => {
      /* the host logs the failure; the card has nothing useful to show */
    })
    return true
  } catch {
    return false
  }
}
