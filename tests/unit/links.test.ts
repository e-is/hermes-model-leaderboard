/**
 * The catalog requires public surfaces only: external links go through ctx.os.openExternal
 * (injected at register time), never through the private preload bridge. The standalone dev
 * page keeps window.open.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { setOpenExternal } from '../../src/doors.ts'
import { openExternal } from '../../src/links.ts'

test('uses the host opener when one was registered', () => {
  const seen: string[] = []
  setOpenExternal((url: string) => {
    seen.push(url)
  })

  openExternal('https://artificialanalysis.ai/login')

  assert.deepEqual(seen, ['https://artificialanalysis.ai/login'])
  setOpenExternal(null)
})

test('falls back to window.open on the standalone page', () => {
  const seen: string[] = []
  const g = globalThis as any
  const previous = g.window
  g.window = { open: (url: string) => seen.push(url) }

  try {
    setOpenExternal(null)
    openExternal('https://example.com')
    assert.deepEqual(seen, ['https://example.com'])
  } finally {
    g.window = previous
  }
})

test('never touches the private preload bridge', async () => {
  const source = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../../src/links.ts', import.meta.url), 'utf8')
  )

  assert.equal(source.includes('hermesDesktop'), false)
})
