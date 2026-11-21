import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { notificationService } from '../services/notificationService'

const storageKey = (userId: string) => `MOVELYA.notification-permission-requested.v1.${userId}`

export function NotificationPermissionPrompt({ userId }: { userId?: string }) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!userId || typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'default' || localStorage.getItem(storageKey(userId))) return
    // This is scoped to the browser storage (and therefore to this device), so
    // a different phone can ask independently without nagging the same person.
    localStorage.setItem(storageKey(userId), '1')
    setVisible(true)
  }, [userId])

  if (!visible || !userId) return null

  async function enable() {
    if (!userId) return
    setLoading(true)
    setMessage('')
    try {
      const result = await notificationService.enablePush(userId)
      if (result === 'subscribed') setMessage('Notificações ativadas neste dispositivo.')
      else if (result === 'permission_granted') setMessage('Permissão ativada. Os lembretes funcionarão enquanto o MOVELYA estiver aberto.')
      else { setVisible(false); return }
      window.setTimeout(() => setVisible(false), 1800)
    } catch {
      setMessage('Não foi possível concluir agora. Você pode ativar depois em Notificações.')
    } finally {
      setLoading(false)
    }
  }

  return <aside className="notification-permission-prompt" role="dialog" aria-label="Ativar notificações">
    <span><BellRing size={18} /></span>
    <div><strong>Ative seus lembretes</strong><p>{message || 'Receba avisos de treino, água e metas neste dispositivo.'}</p></div>
    <button className="notification-permission-prompt__action" onClick={() => void enable()} disabled={loading}>{loading ? 'Ativando…' : 'Ativar'}</button>
    <button className="notification-permission-prompt__close" onClick={() => setVisible(false)} aria-label="Agora não"><X size={15} /></button>
  </aside>
}
