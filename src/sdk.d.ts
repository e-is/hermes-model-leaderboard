/**
 * Ambient types for the subset of `@hermes/plugin-sdk` used by this plugin.
 * Replace with upstream types when Hermes ships them.
 */
declare module '@hermes/plugin-sdk' {
  export type Contribution = {
    id: string
    area: string
    order?: number
    title?: string
    when?: () => boolean
    enabled?: boolean
    render?: () => unknown
    data?: unknown
  }
  export interface PluginContext {
    readonly source: string
    register: (c: Contribution) => () => void
    registerMany: (cs: Contribution[]) => () => void
    rest: <T = unknown>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>
    socket: (path: string, onMessage: (data: unknown) => void) => () => void
    storage: {
      get: (key: string, fallback?: unknown) => any
      set: (key: string, value: unknown) => void
    }
  }
  export type HermesPlugin = {
    id: string
    name?: string
    defaultEnabled?: boolean
    register: (ctx: PluginContext) => void
  }
  export const host: {
    navigate: (path: string) => void
    notify: (input: { kind?: string; message: string }) => void
    request: (method: string, params?: unknown) => Promise<any>
    [k: string]: any
  }
  export const queryClient: any
  export const ROUTES_AREA: string
  export const SIDEBAR_NAV_AREA: string
  export const PALETTE_AREA: string
  export const TITLEBAR_AREAS: { left: string; center: string; right: string }
  // UI kit (loose — real components come from the desktop app at runtime)
  export const Badge: any
  export const Button: any
  export const Codicon: any
  export const ConfirmDialog: any
  export const EmptyState: any
  export const ErrorState: any
  export const Loader: any
  export function cn(...parts: unknown[]): string
}
