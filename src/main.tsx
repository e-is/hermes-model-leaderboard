/**
 * Hermes Model Leaderboard — desktop entry point.
 *
 * Registers the full page `/model-leaderboard`, the sidebar nav entry and a
 * ⌘K palette command; wires the backend door (ctx.rest) for the API calls.
 */
import {
  host,
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  type HermesPlugin,
  type PluginContext
} from '@hermes/plugin-sdk'

import LeaderboardPage from './LeaderboardPage'
import { setRest } from './doors'
import { LOCALES } from './i18n'

const plugin: HermesPlugin = {
  id: 'hermes-model-leaderboard',
  name: 'LLM Model Leaderboard',
  defaultEnabled: true,

  register(ctx: PluginContext) {
    setRest((path, opts) => ctx.rest(path, opts))
    if (ctx.i18n && typeof ctx.i18n.register === 'function') {
      ctx.i18n.register(LOCALES as any)
    }

    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: '/model-leaderboard' },
        render: () => <LeaderboardPage />
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        order: 75,
        data: { path: '/model-leaderboard', label: 'Model Leaderboard', codicon: 'graph' }
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'hermes-model-leaderboard.open',
          label: 'LLM Model Leaderboard : open the leaderboard',
          keywords: ['llm', 'leaderboard', 'model', 'benchmark', 'pricing'],
          run: () => host.navigate('/model-leaderboard')
        }
      }
    ])
  }
}

export default plugin
