/**
 * i18n for the model-leaderboard plugin — same pattern as the kanban-gantt
 * plugin (usePluginI18n + one bundle per locale).
 *
 * The locale bundles live in ``src/locales/<lang>.ts`` — one module per
 * language, so a translation can be reviewed and edited on its own. This file
 * only collects them into ``LOCALES`` and exposes the bound translator.
 *
 * Every Hermes desktop locale has a bundle (17 ids): en, fr, zh, zh-hant, af,
 * ar, de, es, ga, hu, it, ja, ko, pt, ru, tr, uk. The ``LOCALES`` keys ARE the
 * desktop locale ids — ``ctx.i18n.register(LOCALES)`` matches them against the
 * app language — so a hyphenated id keeps its hyphen even though the module's
 * export cannot (``zh-hant`` → ``zhHant``).
 *
 * ``ID`` must be the plugin's real key (``plugin.yaml``'s name): the desktop
 * scopes both the i18n bundle and ``ctx.rest`` by it.
 */
import { useMemo } from 'react'
import { usePluginI18n } from '@hermes/plugin-sdk'
import { en } from './locales/en'
import { fr } from './locales/fr'
import { zh } from './locales/zh'
import { zhHant } from './locales/zh-hant'
import { af } from './locales/af'
import { ar } from './locales/ar'
import { de } from './locales/de'
import { es } from './locales/es'
import { ga } from './locales/ga'
import { hu } from './locales/hu'
import { it } from './locales/it'
import { ja } from './locales/ja'
import { ko } from './locales/ko'
import { pt } from './locales/pt'
import { ru } from './locales/ru'
import { tr } from './locales/tr'
import { uk } from './locales/uk'

const ID = 'model-leaderboard'

const LOCALES = {
  en,
  fr,
  zh,
  af,
  ar,
  de,
  es,
  ga,
  hu,
  it,
  ja,
  ko,
  pt,
  ru,
  tr,
  uk,
  'zh-hant': zhHant
} as const

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
