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
