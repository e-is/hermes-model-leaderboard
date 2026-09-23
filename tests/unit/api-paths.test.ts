/**
 * Guard against the double-prefixed plugin path.
 *
 * `ctx.rest` (the `api()` door in src/doors.ts) already scopes every call to
 * `/api/plugins/<plugin-id>/`, so a path written as `/api/profiles` resolves to
 * `/api/plugins/model-leaderboard/api/profiles` and the gateway answers 405
 * "Method not allowed". That bug shipped twice (models, then profile save), so
 * it gets a test instead of another review pass.
 *
 * Run: node --experimental-strip-types --test tests/unit/api-paths.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

/** Every string literal passed as the first argument of an `api(...)` call. */
function apiPaths(source: string): string[] {
  const out: string[] = []
  const re = /api\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g
  for (const match of source.matchAll(re)) {
    out.push(match[1].slice(1, -1))
  }
  return out
}

test('no api() call re-prefixes the plugin namespace', () => {
  const files = sourceFiles(join(root, 'src'))
  const offenders: string[] = []

  for (const file of files) {
    for (const path of apiPaths(readFileSync(file, 'utf8'))) {
      if (path.startsWith('/api/') || path.startsWith('api/')) {
        offenders.push(`${file.replace(root + '/', '')}: ${path}`)
      }
    }
  }

  assert.deepEqual(offenders, [], `paths must be relative to the plugin namespace: ${offenders.join(', ')}`)
})

test('every api() path starts with a slash and no scheme', () => {
  const files = sourceFiles(join(root, 'src'))
  for (const file of files) {
    for (const path of apiPaths(readFileSync(file, 'utf8'))) {
      assert.ok(path.startsWith('/'), `${file}: ${path} must start with "/"`)
      assert.ok(!/^https?:/.test(path), `${file}: ${path} must not be absolute`)
    }
  }
})
