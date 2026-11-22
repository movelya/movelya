import { supabase } from '../integrations/supabase'

type DiagnosticKind = 'error' | 'unhandled_rejection' | 'performance'
let currentUserId: string | null = null
let started = false
const recent = new Set<string>()

export const observabilityService = {
  start() {
    if (started || typeof window === 'undefined') return
    started = true
    window.addEventListener('error', (event) => report('error', normalizeError(event.error || event.message), { source: String(event.filename || '').slice(0, 180), line: event.lineno }))
    window.addEventListener('unhandledrejection', (event) => report('unhandled_rejection', normalizeError(event.reason)))
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (navigation) void report('performance', 'Navegação concluída', { duration_ms: Math.round(navigation.duration), dom_interactive_ms: Math.round(navigation.domInteractive) })
    }, { once: true })
  },
  identify(userId?: string) { currentUserId = userId || null },
  reportPerformance(name: string, durationMs: number) { return report('performance', name, { duration_ms: Math.round(durationMs) }) },
}

function normalizeError(value: unknown) {
  const raw = value instanceof Error ? value.message : String(value || 'Erro desconhecido')
  // Messages can include API text; retain a concise operational signal only.
  return raw.replace(/https?:\/\/\S+/g, '[url]').replace(/Bearer\s+\S+/gi, 'Bearer [redigido]').slice(0, 420)
}

async function report(kind: DiagnosticKind, message: string, metadata: Record<string, unknown> = {}) {
  const route = typeof window === 'undefined' ? '' : window.location.hash.slice(0, 180)
  const fingerprint = `${kind}:${message}:${route}`
  if (recent.has(fingerprint) || !supabase || !currentUserId || !navigator.onLine) return
  recent.add(fingerprint)
  window.setTimeout(() => recent.delete(fingerprint), 60_000)
  try { await supabase.from('client_diagnostics').insert({ user_id: currentUserId, kind, message, route, metadata }) } catch { /* diagnostics must never affect the member experience */ }
}
