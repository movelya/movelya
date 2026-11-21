import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('security headers are scoped to every route', () => {
  const headers = read('public/_headers')
  assert.match(headers, /^\/\*\r?\n/m)
  assert.match(headers, /Content-Security-Policy:/)
  assert.match(headers, /X-Content-Type-Options: nosniff/)
  assert.match(headers, /X-Frame-Options: DENY/)
})

test('viewport preserves browser zoom for accessibility', () => {
  const html = read('index.html')
  assert.doesNotMatch(html, /user-scalable\s*=\s*no/i)
  assert.doesNotMatch(html, /maximum-scale\s*=/i)
})

test('PWA fetches current application code before cached code', () => {
  const worker = read('public/sw.js')
  assert.match(worker, /__BUILD_ID__/)
  assert.match(worker, /\['script', 'style'\].*networkFirst/)
  assert.match(worker, /self\.clients\.claim\(\)/)
})
