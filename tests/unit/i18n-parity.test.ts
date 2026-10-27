/**
 * Parity guard for the locale bundles.
 *
 * Every Hermes desktop locale ships a bundle in `src/locales/`, and the desktop
 * only renders the strings its bundle actually contains: a key missing from one
 * locale falls back to the default bundle silently, an extra key is dead weight,
 * and a string that lost its interpolating function renders `[object Object]` or
 * a raw template. So each bundle must match `en` exactly — same recursive key
 * set, same value kind, same function arity — and must be wired into
 * `src/i18n.ts`'s `LOCALES` map under its Hermes locale id.
 *
 * The bundles are imported from disk (not from `LOCALES`) because `i18n.ts`
 * imports `react` and `@hermes/plugin-sdk`; the directory is read so a new
 * bundle cannot be added without also being wired in.
 *
 * Run: node --experimental-strip-types --test tests/unit/i18n-parity.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const localesDir = join(root, 'src', 'locales')

type Leaf = { kind: 'string' | 'function' | 'number' | 'boolean'; value: any; arity: number }

/** Flat `path → leaf` view of a bundle, so two trees compare by key path. */
function flatten(node: any, prefix = '', out = new Map<string, Leaf>()): Map<string, Leaf> {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'function') {
      out.set(path, { kind: 'function', value, arity: value.length })
    } else if (value !== null && typeof value === 'object') {
      flatten(value, path, out)
    } else {
      out.set(path, { kind: typeof value as Leaf['kind'], value, arity: 0 })
    }
  }
  return out
}

/** `zh-hant.ts` keeps its hyphen: the file name IS the Hermes locale id. */
function localeId(file: string): string {
  return file.replace(/\.ts$/, '')
}

const files = readdirSync(localesDir).filter(f => f.endsWith('.ts')).sort()
const en = flatten((await import(pathToFileURL(join(localesDir, 'en.ts')).href)).en)
const enKeys = [...en.keys()].sort()

test('every desktop locale has a bundle module', () => {
  const expected = [
    'af', 'ar', 'de', 'en', 'es', 'fr', 'ga', 'hu', 'it', 'ja',
    'ko', 'pt', 'ru', 'tr', 'uk', 'zh', 'zh-hant'
  ].sort()
  // Sort the IDS, not the file names: 'zh-hant.ts' sorts before 'zh.ts' ("-" < ".").
  assert.deepEqual(files.map(localeId).sort(), expected)
})

test('every bundle is wired into src/i18n.ts LOCALES', () => {
  const source = readFileSync(join(root, 'src', 'i18n.ts'), 'utf8')
  const missingImport: string[] = []
  const missingKey: string[] = []

  for (const file of files) {
    const id = localeId(file)
    if (!source.includes(`from './locales/${id}'`)) missingImport.push(id)
    // The LOCALES literal: `en,` … `'zh-hant': zhHant`
    const wired = new RegExp(`(^|[\\s,{])(['\"]?)${id.replace('-', '\\-')}\\2\\s*[:,]`, 'm')
    if (!wired.test(source)) missingKey.push(id)
  }

  assert.deepEqual(missingImport, [], 'bundle modules never imported by src/i18n.ts')
  assert.deepEqual(missingKey, [], 'locale ids missing from the LOCALES map')
})

for (const file of files) {
  const id = localeId(file)
  const mod = await import(pathToFileURL(join(localesDir, file)).href)
  const exportName = id === 'zh-hant' ? 'zhHant' : id
  const bundle = (mod as any)[exportName]
  const leaves = flatten(bundle)
  const keys = [...leaves.keys()]

  test(`${id}: identical key set to en`, () => {
    const missing = enKeys.filter(k => !leaves.has(k))
    const extra = keys.filter(k => !en.has(k)).sort()
    assert.deepEqual(missing, [], `${id} is missing keys`)
    assert.deepEqual(extra, [], `${id} has keys en does not`)
  })

  test(`${id}: identical value kinds and function arity to en`, () => {
    const mismatched: string[] = []
    for (const [path, ref] of en) {
      const got = leaves.get(path)
      if (!got) continue // reported by the key-set test
      if (got.kind !== ref.kind) mismatched.push(`${path}: ${ref.kind} → ${got.kind}`)
      else if (ref.kind === 'function' && got.arity !== ref.arity) {
        mismatched.push(`${path}: arity ${ref.arity} → ${got.arity}`)
      }
    }
    assert.deepEqual(mismatched, [], `${id} value kinds/arity diverged from en`)
  })

  test(`${id}: no empty strings`, () => {
    const empty = [...leaves.entries()]
      .filter(([, leaf]) => leaf.kind === 'string' && leaf.value.trim() === '')
      .map(([path]) => path)
    assert.deepEqual(empty, [], `${id} has empty strings`)
  })
}
