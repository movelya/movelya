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
  assert.match(worker, /self\.skipWaiting\(\)/)
})

test('GitHub Pages versions the service worker on every deploy', () => {
  const script = read('scripts/prepare-github-pages.mjs')
  assert.match(script, /dist-github/)
  assert.match(script, /__BUILD_ID__/)
  assert.match(read('package.json'), /prepare-github-pages\.mjs/)
})

test('Notification permission prompt is shown once per user and device', () => {
  const prompt = read('src/components/NotificationPermissionPrompt.tsx')
  assert.match(prompt, /MOVELYA\.notification-permission-requested\.v1/)
  assert.match(prompt, /Notification\.permission !== 'default'/)
  assert.match(prompt, /notificationService\.enablePush/)
})

test('light theme audit protects legacy feature styles and keyboard focus', () => {
  const audit = read('src/lightThemeAudit.css')
  assert.match(read('src/main.tsx'), /lightThemeAudit\.css/)
  assert.match(audit, /:root\[data-theme="light"\]/)
  assert.match(audit, /:focus-visible/)
  assert.match(audit, /prefers-reduced-motion/)
  assert.match(audit, /\.body-page/)
  assert.match(audit, /\.water-page/)
  assert.match(audit, /\.community-page/)
})
