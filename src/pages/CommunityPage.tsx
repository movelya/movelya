import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Ban, Dumbbell, Ellipsis, Flag, Flame, Footprints, Heart, LoaderCircle, Medal, MessageCircle, Pencil, Salad, Search, Send, Trash2, Trophy, UserRound, UsersRound, X } from 'lucide-react'
import { communityService, type CommunityComment, type CommunityData, type CommunityFeedPage, type CommunityPost, type CommunityPostType, type CommunityProfileSearchResult, type CommunityRankingCategory, type CommunityRankingData, type CommunityRankingScope, type CommunityReportReason } from '../services/communityService'
import { CreateCommunityPostModal } from '../components/CreateCommunityPostModal'
import { CommunityClubsPanel } from '../components/CommunityClubsPanel'
import '../community.css'

type CommunityTab = 'feed' | 'ranking' | 'clubs'

export function CommunityPage({ userId, onNavigate }: { userId: string; onNavigate: (path: string) => void }) {
  const [data, setData] = useState<CommunityData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<CommunityTab>('feed')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CommunityProfileSearchResult[]>([])
  const [searchingProfiles, setSearchingProfiles] = useState(false)
  const [searchedFeed, setSearchedFeed] = useState<CommunityFeedPage | null>(null)
  const [searchingPosts, setSearchingPosts] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [notice, setNotice] = useState('')
  const [composerType, setComposerType] = useState<CommunityPostType | null>(null)
  const [pendingLikes, setPendingLikes] = useState<Record<string, boolean>>({})
  const [blockRevision, setBlockRevision] = useState(0)
  const pendingLikeIds = useRef(new Set<string>())

  useEffect(() => {
    let mounted = true
    communityService.load(userId).then((result) => mounted && setData(result)).catch(() => mounted && setError('Não foi possível atualizar a comunidade agora.'))
    return () => { mounted = false }
  }, [userId])

  useEffect(() => {
    const term = query.trim()
    if (term.replace(/^@/, '').length < 2) { setSearchResults([]); setSearchingProfiles(false); return }
    let active = true
    const timer = window.setTimeout(() => {
      setSearchingProfiles(true)
      communityService.searchProfiles(term).then((items) => active && setSearchResults(items)).catch(() => active && setSearchResults([])).finally(() => active && setSearchingProfiles(false))
    }, 230)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setSearchedFeed(null); setSearchingPosts(false); return }
    let active = true
    const timer = window.setTimeout(() => {
      setSearchingPosts(true)
      communityService.loadFeedPage(userId, null, term).then((result) => active && setSearchedFeed(result)).catch(() => active && setSearchedFeed({ posts: [], nextCursor: null, hasMore: false })).finally(() => active && setSearchingPosts(false))
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, userId])

  const visiblePosts = useMemo(() => query.trim().length >= 2 ? searchedFeed?.posts ?? [] : data?.posts ?? [], [data?.posts, query, searchedFeed])

  async function loadMore() {
    if (!data?.hasMore || !data.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await communityService.loadFeedPage(userId, data.nextCursor)
      setData((current) => current ? { ...current, posts: [...current.posts, ...page.posts], nextCursor: page.nextCursor, hasMore: page.hasMore } : current)
    } catch { setNotice('Não foi possível carregar mais publicações agora.') }
    finally { setLoadingMore(false) }
  }

  async function toggleLike(post: CommunityPost) {
    if (pendingLikeIds.current.has(post.id)) return
    const optimistic = { ...post, likedByMe: !post.likedByMe, likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)) }
    pendingLikeIds.current.add(post.id)
    setPendingLikes((items) => ({ ...items, [post.id]: true }))
    setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? optimistic : item) } : current)
    try {
      const updated = await communityService.toggleLike(post, userId)
      setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? updated : item) } : current)
    } catch {
      setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? post : item) } : current)
      setNotice('Não foi possível registrar sua curtida agora.')
    } finally {
      pendingLikeIds.current.delete(post.id)
      setPendingLikes((items) => { const next = { ...items }; delete next[post.id]; return next })
    }
  }

  async function blockUser(blockedUserId: string) {
    try {
      await communityService.blockUser(blockedUserId, userId)
      setData((current) => current ? { ...current, posts: current.posts.filter((post) => post.userId !== blockedUserId) } : current)
      setSearchResults((items) => items.filter((item) => item.userId !== blockedUserId))
      setBlockRevision((value) => value + 1)
      setNotice('Usuário bloqueado. As publicações e interações dele não aparecem mais para você.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Não foi possível bloquear este usuário agora.')
      throw cause
    }
  }

  function retry() { setError(''); setData(null); communityService.load(userId).then(setData).catch(() => setError('Não foi possível atualizar a comunidade agora.')) }

  if (error) return <section className="community-state"><UsersRound size={28} /><h1>Comunidade indisponível</h1><p>{error}</p><button onClick={retry}>Tentar novamente</button></section>

  return <section className="community-page">
    <header className="community-heading">
      <div><span className="page-eyebrow">EM MOVIMENTO</span><h1>Comunidade</h1><p>Troque inspiração por consistência, no seu ritmo.</p></div>
      <div className="community-heading-actions"><button className="community-my-profile" onClick={() => onNavigate(`/perfil-social?user=${encodeURIComponent(userId)}`)}><UserRound size={16} /><span>Meu perfil</span></button><button className={`community-search ${searchOpen ? 'is-open' : ''}`} onClick={() => setSearchOpen((value) => !value)} aria-label={searchOpen ? 'Fechar pesquisa' : 'Pesquisar na comunidade'}>{searchOpen ? <X size={18} /> : <Search size={18} />}<span>Pesquisar</span></button></div>
    </header>

    {searchOpen && <div className="community-search-wrap"><label className="community-search-field"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Publicação ou @usuário" /><button onClick={() => setQuery('')} aria-label="Limpar pesquisa"><X size={14} /></button></label>{(searchingProfiles || searchResults.length > 0) && <div className="community-profile-search-results">{searchingProfiles ? <span><LoaderCircle size={14} className="is-spinning" /> Buscando perfis…</span> : searchResults.map((item) => <button key={item.userId} onClick={() => onNavigate(`/perfil-social?user=${encodeURIComponent(item.userId)}`)}><i>{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</i><span><strong>{item.name}</strong><small>@{item.username}{item.isPrivate ? ' · perfil privado' : ''}</small></span></button>)}</div>}</div>}
    <div className="community-tabs" role="tablist" aria-label="Seções da comunidade"><Tab label="Feed" active={tab === 'feed'} onClick={() => setTab('feed')} /><Tab label="Ranking" active={tab === 'ranking'} onClick={() => setTab('ranking')} /><Tab label="Clubes" active={tab === 'clubs'} onClick={() => setTab('clubs')} /></div>

    {!data ? <CommunityLoading /> : <>
      {tab === 'feed' && <>
        <section className="community-summary" aria-label="Seu resumo na comunidade">
          <SummaryCard icon={Flame} label="Sua sequência" value={data.summary.streak ? `${data.summary.streak} ${data.summary.streak === 1 ? 'dia' : 'dias'}` : 'Comece hoje'} tone="orange" />
          <SummaryCard icon={Medal} label="Maior sequência" value={`${data.summary.bestStreak} ${data.summary.bestStreak === 1 ? 'dia' : 'dias'}`} tone="orange" />
          <SummaryCard icon={Trophy} label="Sua posição" value={data.summary.position ? `#${data.summary.position} semanal` : 'Sem posição'} tone="green" />
          <SummaryCard icon={Dumbbell} label="Treinos na semana" value={String(data.summary.weeklyWorkouts)} tone="blue" />
        </section>
        <PublishActivity onOpen={setComposerType} />
        <div className="community-content-grid">
          <div className="community-feed" aria-label="Feed da comunidade">
            <div className="community-section-heading"><div><small>FEED</small><h2>O que move a comunidade</h2></div>{query && <span>{visiblePosts.length} resultado{visiblePosts.length === 1 ? '' : 's'}</span>}</div>
            {searchingPosts ? <div className="community-feed-searching"><LoaderCircle size={17} className="is-spinning" /> Buscando em toda a Comunidade…</div> : visiblePosts.length ? <>{visiblePosts.map((post) => <PostCard key={`${post.id}:${blockRevision}`} post={post} viewerId={userId} liking={Boolean(pendingLikes[post.id])} onLike={() => void toggleLike(post)} onOpenProfile={() => onNavigate(`/perfil-social?user=${encodeURIComponent(post.userId)}`)} onCommentAdded={() => setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, comments: item.comments + 1 } : item) } : current)} onCommentRemoved={() => setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, comments: Math.max(0, item.comments - 1) } : item) } : current)} onPostUpdated={(caption, editedAt) => setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, caption, editedAt } : item) } : current)} onPostDeleted={() => setData((current) => current ? { ...current, posts: current.posts.filter((item) => item.id !== post.id) } : current)} onBlockUser={blockUser} />)}{!query.trim() && data.hasMore && <button className="community-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <><LoaderCircle size={15} className="is-spinning" /> Carregando</> : 'Carregar mais publicações'}</button>}</> : <FeedEmpty searched={Boolean(query)} onNavigate={onNavigate} />}
          </div>
          <WeeklyRanking ranking={data.ranking} onMore={() => setTab('ranking')} />
        </div>
      </>}
      {tab === 'ranking' && <RankingPanel userId={userId} initialRanking={data.ranking} onOpenProfile={(targetUserId) => onNavigate(`/perfil-social?user=${encodeURIComponent(targetUserId)}`)} />}
      {tab === 'clubs' && <CommunityClubsPanel userId={userId} />}
    </>}
    {notice && <button className="community-toast" onClick={() => setNotice('')} role="status">{notice}<X size={14} /></button>}
    {composerType && <CreateCommunityPostModal userId={userId} initialType={composerType} onClose={() => setComposerType(null)} onPublished={() => { setComposerType(null); setData(null); communityService.load(userId).then(setData).catch(() => setError('A publicação foi criada, mas não foi possível atualizar o feed.')) }} />}
  </section>
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick}>{label}</button> }
function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Flame; label: string; value: string; tone: string }) { return <article className={`community-summary-card is-${tone}`}><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></article> }

function PublishActivity({ onOpen }: { onOpen: (type: CommunityPostType) => void }) {
  return <section className="community-publish"><button className="community-publish__intro" onClick={() => onOpen('general_fitness')}><span><UsersRound size={18} /></span><div><small>COMPARTILHE SUA ATIVIDADE</small><h2>Seu movimento pode inspirar alguém.</h2></div></button><nav aria-label="Escolher atividade para compartilhar"><button onClick={() => onOpen('workout')}><Dumbbell size={16} />Treino</button><button onClick={() => onOpen('running')}><Footprints size={16} />Corrida</button><button onClick={() => onOpen('food')}><Salad size={16} />Refeição</button></nav></section>
}

function PostCard({ post, viewerId, liking, onLike, onOpenProfile, onCommentAdded, onCommentRemoved, onPostUpdated, onPostDeleted, onBlockUser }: { post: CommunityPost; viewerId: string; liking: boolean; onLike: () => void; onOpenProfile: () => void; onCommentAdded: () => void; onCommentRemoved: () => void; onPostUpdated: (caption: string, editedAt: string) => void; onPostDeleted: () => void; onBlockUser: (blockedUserId: string) => Promise<void> }) {
  const initials = post.profile.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const Icon = postIcon(post.type)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [comment, setComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [postMenuOpen, setPostMenuOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; name: string } | null>(null)
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function openComments() {
    const nextOpen = !commentsOpen
    setCommentsOpen(nextOpen)
    if (!nextOpen || comments.length || loadingComments) return
    setLoadingComments(true); setCommentError('')
    try { setComments(await communityService.listComments(post.id)) }
    catch { setCommentError('Não foi possível carregar os comentários agora.') }
    finally { setLoadingComments(false) }
  }

  async function sendComment() {
    if (!comment.trim() || sendingComment) return
    setSendingComment(true); setCommentError('')
    try {
      const created = await communityService.createComment(post.id, viewerId, comment.slice(0, 500))
      setComments((items) => [...items, created]); setComment(''); onCommentAdded()
    } catch (error) { setCommentError(error instanceof Error ? error.message : 'Não foi possível enviar seu comentário.') }
    finally { setSendingComment(false) }
  }

  async function deleteComment(commentId: string) {
    setDeletingCommentId(commentId); setCommentError('')
    try { await communityService.deleteComment(commentId, viewerId); setComments((items) => items.filter((item) => item.id !== commentId)); onCommentRemoved() }
    catch { setCommentError('Não foi possível excluir o comentário agora.') }
    finally { setDeletingCommentId(null) }
  }

  async function blockUser(targetUserId: string, name: string) {
    if (!window.confirm(`Bloquear ${name}? As publicações e comentários dessa pessoa não aparecerão mais para você.`)) return
    setBlockingUserId(targetUserId); setCommentError('')
    try {
      await onBlockUser(targetUserId)
      setComments((items) => items.filter((item) => item.userId !== targetUserId))
    } catch { setCommentError('Não foi possível bloquear este usuário agora.') }
    finally { setBlockingUserId(null); setPostMenuOpen(false) }
  }

  async function submitReport(reason: CommunityReportReason, details: string) {
    if (!reportTarget) return
    const target = reportTarget
    setReportingCommentId(target.type === 'comment' ? target.id : null); setCommentError('')
    try {
      if (target.type === 'post') await communityService.reportPost(target.id, viewerId, reason, details)
      else await communityService.reportComment(target.id, viewerId, reason, details)
      setReportTarget(null); setCommentError('Denúncia enviada para análise manual.')
    } catch (cause) { setCommentError(cause instanceof Error ? cause.message : 'Não foi possível enviar a denúncia agora.') }
    finally { setReportingCommentId(null) }
  }

  async function deletePost() {
    if (!window.confirm('Excluir esta publicação? Comentários e curtidas também serão removidos.')) return
    setDeleting(true); setCommentError('')
    try { await communityService.deletePost(post.id, viewerId); onPostDeleted() }
    catch (cause) { setCommentError(cause instanceof Error ? cause.message : 'Não foi possível excluir a publicação agora.') }
    finally { setDeleting(false); setPostMenuOpen(false) }
  }

  return <article className="community-post">
    <header><button className="community-post__author" onClick={onOpenProfile} aria-label={`Abrir perfil de ${post.profile.name}`}><span className="community-avatar">{post.profile.avatarUrl ? <img src={post.profile.avatarUrl} alt="" /> : initials}</span><span><strong>{post.profile.name}</strong><small><Flame size={12} fill="currentColor" /> atividade compartilhada</small></span></button><div className="community-post__menu"><button onClick={() => setPostMenuOpen((open) => !open)} aria-label={`Opções da publicação de ${post.profile.name}`}><Ellipsis size={19} /></button>{postMenuOpen && <div role="menu">{post.userId === viewerId ? <><button onClick={() => { setEditing(true); setPostMenuOpen(false) }}><Pencil size={14} /> Editar publicação</button><button className="is-danger" disabled={deleting} onClick={() => void deletePost()}><Trash2 size={14} /> {deleting ? 'Excluindo…' : 'Excluir publicação'}</button></> : <><button onClick={() => { setReportTarget({ type: 'post', id: post.id, name: post.profile.name }); setPostMenuOpen(false) }}><Flag size={14} /> Denunciar publicação</button><button className="is-danger" disabled={blockingUserId === post.userId} onClick={() => void blockUser(post.userId, post.profile.name)}><Ban size={14} /> {blockingUserId === post.userId ? 'Bloqueando…' : 'Bloquear usuário'}</button></>}</div>}</div></header>
    {post.mediaUrl ? <img className="community-post__image" src={post.mediaUrl} alt="Publicação compartilhada pela comunidade" loading="lazy" /> : <div className="community-post__missing-media"><Icon size={28} /><span>{postTypeLabel(post.type)}</span></div>}
    <div className="community-post__body"><p>{post.caption || 'Atividade compartilhada na comunidade.'}</p><div className="community-post__activity"><span><Icon size={14} /></span>{activityCopy(post)}</div></div>
    <footer><button className={`${post.likedByMe ? 'is-liked' : ''} ${post.likedByMe && !liking ? 'is-like-pop' : ''}`} onClick={onLike} disabled={liking} aria-label={post.likedByMe ? 'Remover curtida' : 'Curtir publicação'}><Heart size={18} fill={post.likedByMe ? 'currentColor' : 'none'} /><b>{post.likes}</b></button><button className={commentsOpen ? 'is-commenting' : ''} onClick={() => void openComments()} aria-expanded={commentsOpen} aria-label="Ver e adicionar comentários"><MessageCircle size={18} /><b>{post.comments}</b></button><time title={post.editedAt ? `Editado em ${new Date(post.editedAt).toLocaleString('pt-BR')}` : undefined}>{relativeDate(post.createdAt)}{post.editedAt ? ' · editado' : ''}</time></footer>
    {commentsOpen && <section className="community-comments" aria-label="Comentários"><header><strong>Comentários</strong><button onClick={() => setCommentsOpen(false)} aria-label="Fechar comentários"><X size={15} /></button></header><div className="community-comments__list">{loadingComments ? <span className="community-comments__loading"><LoaderCircle size={14} className="is-spinning" /> Carregando comentários…</span> : comments.length ? comments.map((item) => <article key={item.id}><span className="community-comment-avatar">{item.profile.avatarUrl ? <img src={item.profile.avatarUrl} alt="" /> : item.profile.name.slice(0, 1)}</span><div><strong>{item.profile.name}</strong><p>{item.content}</p><small>{relativeDate(item.createdAt)}</small>{item.userId === viewerId ? <button className="community-comment-action" disabled={deletingCommentId === item.id} onClick={() => void deleteComment(item.id)}>{deletingCommentId === item.id ? 'Excluindo…' : 'Excluir'}</button> : <span className="community-comment-actions"><button className="community-comment-action" onClick={() => setReportTarget({ type: 'comment', id: item.id, name: item.profile.name })}><Flag size={12} /> Denunciar</button><button className="community-comment-action is-danger" disabled={blockingUserId === item.userId} onClick={() => void blockUser(item.userId, item.profile.name)}><Ban size={12} /> Bloquear</button></span>}</div></article>) : <p className="community-comments__empty">Seja o primeiro a comentar.</p>}</div><div className="community-comment-form"><input value={comment} maxLength={500} disabled={sendingComment} placeholder="Adicionar comentário..." onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendComment() } }} /><button onClick={() => void sendComment()} disabled={!comment.trim() || sendingComment} aria-label="Enviar comentário">{sendingComment ? <LoaderCircle size={15} className="is-spinning" /> : <Send size={15} />}</button></div>{commentError && <p className="community-comments__error">{commentError}</p>}</section>}
    {!post.isPermanent && post.expiresAt && <PostExpiration expiresAt={post.expiresAt} isOwner={post.userId === viewerId} />}
    {reportTarget && <CommunityReportModal target={reportTarget} onClose={() => setReportTarget(null)} onSubmit={submitReport} />}
    {editing && <EditPostModal post={post} userId={viewerId} onClose={() => setEditing(false)} onSaved={(caption, editedAt) => { onPostUpdated(caption, editedAt); setEditing(false) }} />}
  </article>
}

function EditPostModal({ post, userId, onClose, onSaved }: { post: CommunityPost; userId: string; onClose: () => void; onSaved: (caption: string, editedAt: string) => void }) {
  const [caption, setCaption] = useState(post.caption), [saving, setSaving] = useState(false), [error, setError] = useState('')
  async function save() { if (!caption.trim() || saving) return; setSaving(true); setError(''); try { const updated = await communityService.updatePost(post.id, userId, caption); onSaved(updated.caption, updated.editedAt) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a edição.') } finally { setSaving(false) } }
  return createPortal(<div className="community-edit-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><section className="community-edit-modal" role="dialog" aria-modal="true" aria-labelledby="community-edit-title"><button onClick={onClose} disabled={saving} aria-label="Fechar"><X size={17} /></button><small>EDITAR PUBLICAÇÃO</small><h2 id="community-edit-title">Atualize sua legenda</h2><p>A publicação mostrará “editado” para manter o contexto das interações.</p><textarea value={caption} maxLength={500} disabled={saving} onChange={(event) => setCaption(event.target.value)} /><span>{caption.length}/500</span>{error && <strong role="alert">{error}</strong>}<footer><button onClick={onClose} disabled={saving}>Cancelar</button><button onClick={() => void save()} disabled={!caption.trim() || saving}>{saving ? <LoaderCircle size={15} className="is-spinning" /> : <Pencil size={15} />} Salvar edição</button></footer></section></div>, document.body)
}

function WeeklyRanking({ ranking, onMore }: { ranking: CommunityData['ranking']; onMore: () => void }) { return <aside className="community-ranking-card"><header><div><small>SEQUÊNCIAS ATIVAS</small><h2>Ritmo em destaque</h2></div><Trophy size={19} /></header>{ranking.entries.length ? <ol>{ranking.entries.slice(0, 3).map((item) => <li key={item.userId}><b>{item.position}</b><span className="ranking-avatar">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{formatRankingMetric('streak', item.metric)}</small></div></li>)}</ol> : <p>O ranking aparece após o primeiro movimento válido na Comunidade.</p>}<button onClick={onMore}>Ver ranking <ArrowRight size={15} /></button></aside> }

function CommunityReportModal({ target, onClose, onSubmit }: { target: { type: 'post' | 'comment'; id: string; name: string }; onClose: () => void; onSubmit: (reason: CommunityReportReason, details: string) => Promise<void> }) {
  const [reason, setReason] = useState<CommunityReportReason>('inappropriate_content')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return
    setSending(true)
    try { await onSubmit(reason, details.trim()) }
    finally { setSending(false) }
  }

  if (typeof document === 'undefined') return null
  return createPortal(<div className="community-report-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !sending && onClose()}>
    <form className="community-report-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="community-report-title">
      <button type="button" className="community-report-modal__close" disabled={sending} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      <span><Flag size={20} /></span><small>DENÚNCIA</small><h2 id="community-report-title">Denunciar {target.type === 'post' ? 'publicação' : 'comentário'}</h2>
      <p>Seu relato será revisado manualmente. A outra pessoa não recebe sua identidade.</p>
      <label>Motivo<select value={reason} disabled={sending} onChange={(event) => setReason(event.target.value as CommunityReportReason)}><option value="spam">Spam</option><option value="harassment">Assédio</option><option value="inappropriate_content">Conteúdo inadequado</option><option value="off_topic">Fora do tema fitness</option><option value="other">Outro</option></select></label>
      <label>Detalhes opcionais <span>{details.length}/500</span><textarea value={details} maxLength={500} disabled={sending} onChange={(event) => setDetails(event.target.value)} placeholder="Ajude a equipe a entender o contexto." /></label>
      <button className="community-report-modal__submit" disabled={sending}>{sending ? <LoaderCircle size={16} className="is-spinning" /> : <Flag size={16} />} Enviar denúncia</button>
      <button type="button" className="community-report-modal__cancel" disabled={sending} onClick={onClose}>Cancelar</button>
    </form>
  </div>, document.body)
}

function RankingPanel({ userId, initialRanking, onOpenProfile }: { userId: string; initialRanking: CommunityRankingData; onOpenProfile: (userId: string) => void }) {
  const [scope, setScope] = useState<CommunityRankingScope>('global')
  const [category, setCategory] = useState<CommunityRankingCategory>('streak')
  const [ranking, setRanking] = useState<CommunityRankingData>(initialRanking)
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([])
  const [clubId, setClubId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { let active = true; communityService.listMyClubs().then((items) => { if (active) setClubs(items.map((club) => ({ id: club.id, name: club.name }))) }).catch(() => undefined); return () => { active = false } }, [userId])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const rankingRequest = clubId ? communityService.loadClubRanking(clubId, category) : communityService.loadRanking(scope, category)
    rankingRequest.then((result) => { if (active) setRanking(result) }).catch(() => { if (active) setError('Não foi possível atualizar este ranking agora.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [scope, category, clubId])

  function selectScope(nextScope: CommunityRankingScope) { setClubId(''); setScope(nextScope) }
  function selectClub(nextClubId: string) { setClubId(nextClubId); if (!nextClubId) setScope('global') }

  return <section className="community-ranking-panel">
    <div className="community-section-heading"><div><small>RANKINGS SEMANAIS</small><h2>Ritmo que inspira</h2><p>{rankingWeekLabel(ranking.weekStart)} · reinicia toda segunda-feira.</p></div></div>
    <div className="community-ranking-filters" aria-label="Escopo do ranking"><button className={!clubId && scope === 'friends' ? 'is-active' : ''} onClick={() => selectScope('friends')}>Amigos</button>{clubs.length ? <label className={clubId ? 'is-active' : ''}>Clube<select value={clubId} onChange={(event) => selectClub(event.target.value)} aria-label="Escolher clube para o ranking"><option value="">Escolher</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label> : <button disabled title="Entre em um clube para acompanhar o ranking dele">Clube</button>}<button className={!clubId && scope === 'global' ? 'is-active' : ''} onClick={() => selectScope('global')}>Global</button></div>
    <div className="community-ranking-categories" role="tablist" aria-label="Categoria do ranking"><RankingCategoryButton icon={Flame} label="Sequência ativa" active={category === 'streak'} onClick={() => setCategory('streak')} /><RankingCategoryButton icon={Dumbbell} label="Mais treinos" active={category === 'workouts'} onClick={() => setCategory('workouts')} /><RankingCategoryButton icon={Footprints} label="Mais quilômetros" active={category === 'distance'} onClick={() => setCategory('distance')} /></div>
    {loading ? <div className="community-ranking-loading"><span /><span /><span /></div> : error ? <div className="community-empty-inline"><Medal size={25} /><strong>{error}</strong></div> : ranking.entries.length ? <><ol className="community-ranking-list">{ranking.entries.map((item) => <li key={item.userId} className={`${item.position <= 3 ? `is-podium is-place-${item.position}` : ''} ${item.isCurrentUser ? 'is-current-user' : ''}`}><b>#{item.position}</b><button onClick={() => onOpenProfile(item.userId)} aria-label={`Abrir perfil de ${item.name}`}>{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</button><button className="community-ranking-list__name" onClick={() => onOpenProfile(item.userId)}><strong>{item.isCurrentUser ? 'Você' : item.name}</strong><small>{item.isCurrentUser ? 'Sua posição nesta categoria' : clubId ? 'Membro do clube' : rankingScopeLabel(scope)}</small></button><em>{formatRankingMetric(category, item.metric)}</em></li>)}</ol>{ranking.myPosition && !ranking.entries.some((item) => item.isCurrentUser) && <div className="community-ranking-you"><span><UserRound size={17} /></span><div><small>SUA POSIÇÃO</small><strong>Você está em #{ranking.myPosition}</strong></div><b>{formatRankingMetric(category, ranking.myMetric ?? 0)}</b></div>}</> : <div className="community-empty-inline"><Medal size={25} /><strong>{scope === 'friends' && !clubId ? 'Nenhum amigo entrou neste ranking ainda.' : 'O ranking está esperando o primeiro movimento.'}</strong><p>{category === 'streak' ? 'Conclua uma atividade física válida para entrar na sequência ativa.' : 'O ranking considera apenas atividades concluídas e válidas nesta semana.'}</p></div>}
  </section>
}

function RankingCategoryButton({ icon: Icon, label, active, onClick }: { icon: typeof Flame; label: string; active: boolean; onClick: () => void }) { return <button role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick}><Icon size={15} />{label}</button> }
function formatRankingMetric(category: CommunityRankingCategory, metric: number) { if (category === 'distance') return `${metric.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`; if (category === 'workouts') return `${metric} ${metric === 1 ? 'treino' : 'treinos'}`; return `${metric} ${metric === 1 ? 'dia' : 'dias'}` }
function rankingScopeLabel(scope: CommunityRankingScope) { return scope === 'friends' ? 'Amigos em comum' : 'Comunidade global' }
function rankingWeekLabel(weekStart: string) { if (!weekStart) return 'Semana atual'; const start = new Date(`${weekStart}T12:00:00`); const end = new Date(start); end.setDate(end.getDate() + 6); return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}` }
function ClubsPlaceholder() { return <section className="community-clubs-placeholder"><span><UsersRound size={25} /></span><small>CLUBES</small><h2>Encontre seu ritmo em grupo.</h2><p>Os clubes serão a próxima etapa da Comunidade. Por enquanto, acompanhe o feed e celebre cada movimento compartilhado.</p></section> }
function FeedEmpty({ searched, onNavigate }: { searched: boolean; onNavigate: (path: string) => void }) { return <div className="community-empty-feed"><span><Flame size={24} /></span><h3>{searched ? 'Nada encontrado por aqui.' : 'A comunidade começa com o primeiro movimento.'}</h3><p>{searched ? 'Tente um nome ou termo diferente.' : 'Conclua um treino, corrida ou refeição e compartilhe quando estiver pronto.'}</p>{!searched && <button onClick={() => onNavigate('/treinos')}>Ir para treinos <ArrowRight size={15} /></button>}</div> }
function CommunityLoading() { return <div className="community-loading" aria-label="Carregando comunidade"><span /><span /><span /><div /><div /></div> }
function postIcon(type: CommunityPostType) { return type === 'workout' ? Dumbbell : type === 'food' ? Salad : type === 'achievement' ? Medal : type === 'general_fitness' ? Flame : Footprints }
function postTypeLabel(type: CommunityPostType) { return ({ workout: 'Treino', running: 'Corrida', walking: 'Caminhada', food: 'Refeição', achievement: 'Conquista', general_fitness: 'Fitness' } as Record<CommunityPostType, string>)[type] }
function activityCopy(post: CommunityPost) { if (post.activity) return `${postTypeLabel(post.type)} • ${post.activity.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km${post.activity.durationSeconds ? ` • ${Math.round(post.activity.durationSeconds / 60)} min` : ''}`; return `${postTypeLabel(post.type)} compartilhado` }
function relativeDate(value: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? 'agora' : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d` }
function daysUntil(value: string) { return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)) }
function PostExpiration({ expiresAt, isOwner }: { expiresAt: string; isOwner: boolean }) { const days = daysUntil(expiresAt); return <p className={`community-post__expiration ${days <= 1 ? 'is-soon' : ''}`}>{days <= 1 && isOwner ? 'Sua publicação será removida em breve. No Pro, suas publicações permanecem salvas.' : `Expira em ${days} ${days === 1 ? 'dia' : 'dias'}`}</p> }
