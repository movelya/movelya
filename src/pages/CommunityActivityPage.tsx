import { ArrowLeft, Heart, LoaderCircle, MessageCircle, Sparkles, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { notificationService } from '../services/notificationService'
import type { AppNotification, SocialNotificationType } from '../types/notification'
import '../communityActivity.css'

type Filter = 'all' | SocialNotificationType

const meta: Record<SocialNotificationType, { label: string; icon: typeof Heart; tone: string }> = {
  social_like: { label: 'Curtidas', icon: Heart, tone: 'like' },
  social_comment: { label: 'Comentários', icon: MessageCircle, tone: 'comment' },
  social_follow: { label: 'Seguidores', icon: UserPlus, tone: 'follow' },
  club_invite: { label: 'Convites', icon: UsersRound, tone: 'invite' },
}

export function CommunityActivityPage({ userId, onNavigate }: { userId: string; onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { let active = true; notificationService.load(userId).then(({ notifications }) => { if (active) setItems(notifications.filter((item) => item.type in meta)) }).finally(() => active && setLoading(false)); return () => { active = false } }, [userId])
  const visible = useMemo(() => filter === 'all' ? items : items.filter((item) => item.type === filter), [items, filter])
  async function open(item: AppNotification) { if (!item.readAt) { setItems((current) => current.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)); await notificationService.markRead(userId, item.id, true).catch(() => undefined) } onNavigate(item.actionPath) }

  return <section className="community-activity-page">
    <button className="community-activity-back" onClick={() => onNavigate('/comunidade')}><ArrowLeft size={17} /> Comunidade</button>
    <header><span><Sparkles size={19} /></span><div><small>SUA REDE</small><h1>Atividade</h1><p>Veja quem interagiu com sua jornada.</p></div></header>
    <nav aria-label="Filtrar atividade"><button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Tudo</button>{(Object.keys(meta) as SocialNotificationType[]).map((type) => <button key={type} className={filter === type ? 'is-active' : ''} onClick={() => setFilter(type)}>{meta[type].label}</button>)}</nav>
    {loading ? <div className="community-activity-loading"><LoaderCircle size={19} className="is-spinning" /> Carregando sua atividade…</div> : visible.length ? <div className="community-activity-list">{visible.map((item) => { const itemMeta = meta[item.type as SocialNotificationType], Icon = itemMeta.icon; return <button key={item.id} className={`${item.readAt ? '' : 'is-unread'} is-${itemMeta.tone}`} onClick={() => void open(item)}><span><Icon size={18} fill={item.type === 'social_like' ? 'currentColor' : 'none'} /></span><div><strong>{item.title}</strong><p>{item.message}</p><small>{relative(item.createdAt)}</small></div>{!item.readAt && <i />}</button> })}</div> : <div className="community-activity-empty"><Sparkles size={26} /><strong>Nenhuma atividade por enquanto</strong><p>Quando alguém curtir, comentar ou seguir você, a novidade aparecerá aqui.</p></div>}
  </section>
}

function relative(value: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000)); return minutes < 1 ? 'Agora' : minutes < 60 ? `Há ${minutes} min` : minutes < 1440 ? `Há ${Math.floor(minutes / 60)} h` : `Há ${Math.floor(minutes / 1440)} d` }
