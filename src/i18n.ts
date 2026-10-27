/**
 * i18n for the model-leaderboard plugin — same pattern as the kanban-gantt
 * plugin (usePluginI18n + en/fr/zh locales — the desktop bundles en, zh, zh-hant,
 * ja, ar, ru, fr, de, es, so a bundle for any of them is selectable).
 *
 * The locale bundles live in ``src/locales/<lang>.ts`` — one module per
 * language, so a translation can be reviewed and edited on its own. This file
 * only collects them into ``LOCALES`` and exposes the bound translator.
 *
 * ``ID`` must be the plugin's real key (``plugin.yaml``'s name): the desktop
 * scopes both the i18n bundle and ``ctx.rest`` by it.
 */
import { useMemo } from 'react'
import { usePluginI18n } from '@hermes/plugin-sdk'
import { en } from './locales/en'
import { fr } from './locales/fr'
import { zh } from './locales/zh'

const ID = 'model-leaderboard'

const LOCALES = { en, fr, zh } as const

function bindI18n(t: any, template: any, prefix = ''): any {
  const out: any = {}
  for (const [key, value] of Object.entries(template)) {
    const path = prefix ? `${prefix}.${key}` : key
    out[key] =
      typeof value === 'function'
        ? (...args: any[]) => t(path, ...args)
        : value && typeof value === 'object'
          ? bindI18n(t, value, path)
          : t(path)
  }
  return out
}

function useLeaderboardI18n() {
  const t = usePluginI18n(ID)
  return useMemo(() => bindI18n(t, LOCALES.en), [t])
}

export { LOCALES, useLeaderboardI18n }
