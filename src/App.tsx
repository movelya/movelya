import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { VitaHeader } from './components/VitaHeader'
import { MobileNavigation, VitaSidebar } from './components/VitaNavigation'
import { useAuth } from './contexts/AuthContext'
import { useOnboardingStatus } from './hooks/useOnboardingStatus'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { NotificationPermissionPrompt } from './components/NotificationPermissionPrompt'
import { PlanWelcomeModal } from './components/PlanWelcomeModal'
import { ErrorPage, LoadingScreen, NotFoundPage, RoutePlaceholder } from './pages/SystemPages'
import { useVitaRoute } from './hooks/useVitaRoute'
import { isPrivateRoute } from './utils/navigation'
import { notificationService } from './services/notificationService'
import { subscriptionService } from './services/subscriptionService'
import { observabilityService } from './services/observabilityService'
import { waterService } from './services/waterService'
import './pwa/registerServiceWorker'
import './productTheme.css'

type ThemePreference = 'light' | 'dark' | 'system'

const AuthPage = lazy(() => import('./pages/AuthPages').then(({ AuthPage }) => ({ default: AuthPage })))
const DailyDashboardPage = lazy(() => import('./pages/DailyDashboardPage').then(({ DailyDashboardPage }) => ({ default: DailyDashboardPage })))
const NutritionPage = lazy(() => import('./pages/Nutrition').then(({ NutritionPage }) => ({ default: NutritionPage })))
const FoodDatabasePage = lazy(() => import('./pages/FoodDatabasePage').then(({ FoodDatabasePage }) => ({ default: FoodDatabasePage })))
const WaterPage = lazy(() => import('./pages/WaterPage').then(({ WaterPage }) => ({ default: WaterPage })))
const StepsPage = lazy(() => import('./pages/StepsPage').then(({ StepsPage }) => ({ default: StepsPage })))
const TrainingHubPage = lazy(() => import('./pages/TrainingHubPage').then(({ TrainingHubPage }) => ({ default: TrainingHubPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(({ OnboardingPage }) => ({ default: OnboardingPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(({ ProfilePage }) => ({ default: ProfilePage })))
const HealthIntegrationsPage = lazy(() => import('./pages/HealthIntegrationsPage').then(({ HealthIntegrationsPage }) => ({ default: HealthIntegrationsPage })))
const BodyEvolutionPage = lazy(() => import('./pages/BodyEvolutionPage').then(({ BodyEvolutionPage }) => ({ default: BodyEvolutionPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then(({ GoalsPage }) => ({ default: GoalsPage })))
const WeeklyReportPage = lazy(() => import('./pages/WeeklyReportPage').then(({ WeeklyReportPage }) => ({ default: WeeklyReportPage })))
const FitnessChatPage = lazy(() => import('./pages/FitnessChatPage').then(({ FitnessChatPage }) => ({ default: FitnessChatPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(({ NotificationsPage }) => ({ default: NotificationsPage })))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage').then(({ AchievementsPage }) => ({ default: AchievementsPage })))
const CommunityPage = lazy(() => import('./pages/CommunityPage').then(({ CommunityPage }) => ({ default: CommunityPage })))
const CommunityProfilePage = lazy(() => import('./pages/CommunityProfilePage').then(({ CommunityProfilePage }) => ({ default: CommunityProfilePage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(({ PrivacyPage }) => ({ default: PrivacyPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(({ AdminPage }) => ({ default: AdminPage })))
const PlansPage = lazy(() => import('./pages/PlansPage').then(({ PlansPage }) => ({ default: PlansPage })))
const CheckoutPage = lazy(() => import('./pages/CheckoutPages').then(({ CheckoutPage }) => ({ default: CheckoutPage })))
const CheckoutConfirmationPage = lazy(() => import('./pages/CheckoutPages').then(({ CheckoutConfirmationPage }) => ({ default: CheckoutConfirmationPage })))

export default function App() {
  const { route, status, navigate, retry } = useVitaRoute()
  const { user, role, roleLoading, loading: authLoading, recoveryMode, logout } = useAuth()
  const onboarding = useOnboardingStatus(user?.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>('light')
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('light')
  const [showPlanWelcome, setShowPlanWelcome] = useState(false)
  const [showQuotaUpgrade, setShowQuotaUpgrade] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const routeStageRef = useRef<HTMLDivElement>(null)
  const planWelcomeCheckRef = useRef<string | null>(null)
  const userId = user?.id

  useEffect(() => { observabilityService.start() }, [])
  useEffect(() => { observabilityService.identify(userId) }, [userId])
  useEffect(() => {
    if (!userId) return
    const sync = () => { void waterService.flushOffline(userId) }
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [userId])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    const savedTheme = window.localStorage.getItem('movelya-theme-preference') || window.localStorage.getItem('movelya-theme')
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') setThemePreference(savedTheme)
    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)
    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }, [])

  const theme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('movelya-theme-preference', themePreference)
  }, [theme, themePreference])

  useEffect(() => {
    if (!user) return
    void notificationService.startReminderScheduler(user.id)
    return () => notificationService.stopReminderScheduler()
  }, [user])

  useEffect(() => {
    if (!user) { setUnreadNotifications(0); return }
    let active = true
    const refresh = () => { void notificationService.unreadCount(user.id).then((count) => active && setUnreadNotifications(count)).catch(() => undefined) }
    refresh()
    const timer = window.setInterval(refresh, 45_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [user])

  useEffect(() => {
    if (!user || !onboarding.completed || onboarding.loading || !route || ['configuracao-inicial', 'checkout', 'checkout-confirmado'].includes(route.id)) return
    const key = `MOVELYA.plan-welcome.v1.${user.id}`
    if (window.localStorage.getItem(key) || planWelcomeCheckRef.current === user.id) return

    let cancelled = false
    planWelcomeCheckRef.current = user.id
    void subscriptionService.getOverview().then((overview) => {
      if (cancelled) return
      // The welcome offer is for Free accounts only. Existing paid members are
      // recorded as handled so they never see it merely because they logged in.
      window.localStorage.setItem(key, overview.code === 'FREE' ? 'shown' : 'skipped-paid')
      if (overview.code === 'FREE') setShowPlanWelcome(true)
    }).catch(() => {
      // Do not interrupt sign-in if subscription data is temporarily unavailable.
      planWelcomeCheckRef.current = null
    })

    return () => { cancelled = true }
  }, [user, onboarding.completed, onboarding.loading, route])

  useEffect(() => {
    if (!user || showPlanWelcome || !onboarding.completed || onboarding.loading || !route || ['configuracao-inicial', 'checkout', 'checkout-confirmado'].includes(route.id)) return
    const welcomeKey = `MOVELYA.plan-welcome.v1.${user.id}`
    if (!window.localStorage.getItem(welcomeKey)) return
    void subscriptionService.getOverview().then((overview) => {
      const nearLimit = overview.code === 'FREE' && overview.quotas.some((quota) => quota.monthly_limit > 0 && quota.used / quota.monthly_limit >= .8)
      const quotaKey = `MOVELYA.quota-upgrade.v1.${user.id}.${overview.renews_at}`
      if (nearLimit && !window.localStorage.getItem(quotaKey)) {
        window.localStorage.setItem(quotaKey, 'shown')
        setShowQuotaUpgrade(true)
      }
    }).catch(() => undefined)
  }, [user, showPlanWelcome, onboarding.completed, onboarding.loading, route])

  function closePlanWelcome() {
    if (user) window.localStorage.setItem(`MOVELYA.plan-welcome.v1.${user.id}`, 'seen')
    setShowPlanWelcome(false)
  }

  function closeQuotaUpgrade() { setShowQuotaUpgrade(false) }

  useEffect(() => {
    const root = routeStageRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const selector = [
      '.daily-panel', '.daily-insight', '.daily-metric', '.today-summary',
      '[class$="-card"]', '[class*="-card "]', '[class$="-panel"]', '[class*="-panel "]',
    ].join(',')
    const observed = new WeakSet<Element>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-scroll-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -24px' })

    const register = () => {
      root.querySelectorAll(selector).forEach((element, index) => {
        if (observed.has(element)) return
        observed.add(element)
        element.classList.add('motion-scroll-reveal')
        ;(element as HTMLElement).style.setProperty('--reveal-delay', `${Math.min(index % 4 * 55, 165)}ms`)
        observer.observe(element)
      })
    }

    register()
    const mutationObserver = new MutationObserver(register)
    mutationObserver.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [route?.id, status])

  useEffect(() => {
    if (authLoading || roleLoading || onboarding.loading || status === 'booting' || status === 'transitioning') return
    if (import.meta.env.DEV && !user && route?.id === 'configuracao-inicial') return
    if (import.meta.env.DEV && !user && (route?.id === 'inicio' || route?.id === 'conquistas' || route?.id === 'comunidade')) return
    if (recoveryMode && route?.id !== 'redefinir-senha') {
      navigate('/redefinir-senha')
      return
    }
    if (!user && isPrivateRoute(route)) {
      navigate('/entrar')
      return
    }
    if (user && !onboarding.completed && route?.id !== 'configuracao-inicial' && route?.id !== 'redefinir-senha' && route?.id !== 'confirmar-email') {
      navigate('/configuracao-inicial')
      return
    }
    if (user && onboarding.completed && route?.id === 'configuracao-inicial') {
      navigate('/inicio')
      return
    }
    if (user && route?.public && route.id !== 'redefinir-senha' && route.id !== 'confirmar-email') navigate('/inicio')
    if (user && route?.id === 'sair') void logout().then(() => navigate('/entrar'))
    if (user && route?.id === 'administracao' && role === 'user') navigate('/inicio')
  }, [authLoading, roleLoading, onboarding.loading, onboarding.completed, status, recoveryMode, route, user, role, navigate, logout])

  async function handleLogout() {
    await logout()
    navigate('/entrar')
  }

  if (status === 'booting' || authLoading || roleLoading || (Boolean(user) && onboarding.loading)) return <LoadingScreen />
  if (status === 'error') return <ErrorPage onRetry={retry} />
  if (import.meta.env.DEV && !user && route?.id === 'configuracao-inicial') {
    return <Suspense fallback={<LoadingScreen />}><OnboardingPage userId="development-preview" initialName="João Silva" onComplete={() => undefined} /></Suspense>
  }
  if ((!user && isPrivateRoute(route) && !(import.meta.env.DEV && (route?.id === 'inicio' || route?.id === 'conquistas' || route?.id === 'comunidade'))) || (recoveryMode && route?.id !== 'redefinir-senha')) return <LoadingScreen />
  if (route?.public) return <><PwaInstallPrompt /><PwaUpdatePrompt /><NotificationPermissionPrompt userId={user?.id} /><Suspense fallback={<LoadingScreen />}><AuthPage routeId={route.id} navigate={navigate} /></Suspense></>
  if (user && route?.id === 'configuracao-inicial') {
    return <Suspense fallback={<LoadingScreen />}><OnboardingPage
      userId={user.id}
      initialName={String(user.user_metadata?.full_name ?? '')}
      onComplete={() => {
        onboarding.markCompleted()
        navigate('/inicio')
      }}
    /></Suspense>
  }

  return (
    <AppErrorBoundary>
      <PwaInstallPrompt />
      <PwaUpdatePrompt />
      <NotificationPermissionPrompt userId={user?.id} />
      {showPlanWelcome ? <PlanWelcomeModal onChooseFree={closePlanWelcome} onChoosePaid={(planCode) => { closePlanWelcome(); navigate(`/checkout?plan=${planCode}`) }} /> : showQuotaUpgrade && <PlanWelcomeModal mode="quota-warning" onChooseFree={closeQuotaUpgrade} onChoosePaid={(planCode) => { closeQuotaUpgrade(); navigate(`/checkout?plan=${planCode}`) }} />}
      <div className="vita-shell">
        <VitaSidebar
          activeRoute={route?.id}
          isOpen={sidebarOpen}
          onNavigate={(path) => {
            navigate(path)
            setSidebarOpen(false)
          }}
          onLogout={handleLogout}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="vita-app">
          <VitaHeader
            route={route}
            onOpenMenu={() => setSidebarOpen(true)}
            onNavigate={navigate}
            theme={theme}
            themePreference={themePreference}
            onSetTheme={setThemePreference}
            unreadNotifications={unreadNotifications}
          />

          <main className={`vita-main ${status === 'transitioning' ? 'is-transitioning' : ''}`}>
            <div className="route-progress" aria-hidden="true">
              {status === 'transitioning' && <span />}
            </div>
            <div className="vita-content" aria-live="polite">
              <div ref={routeStageRef} key={`${route?.id ?? 'not-found'}:${typeof window === 'undefined' ? '' : window.location.search}`} className="vita-route-stage">
              <Suspense fallback={<LoadingScreen />}>{route?.id === 'inicio' && (user || import.meta.env.DEV) ? (
                <DailyDashboardPage userId={user?.id ?? '00000000-0000-0000-0000-000000000000'} onNavigate={navigate} />
              ) : route?.id === 'dieta' && user ? (
                <NutritionPage userId={user.id} onNavigate={navigate} />
              ) : route?.id === 'alimentos' && user ? (
                <FoodDatabasePage userId={user.id} />
              ) : route?.id === 'agua' && user ? (
                <WaterPage userId={user.id} />
              ) : route?.id === 'atividades' && user ? (
                <StepsPage userId={user.id} />
              ) : route?.id === 'treinos' && user ? (
                <TrainingHubPage userId={user.id} />
              ) : route?.id === 'perfil' ? (
                <ProfilePage userId={user?.id ?? ''} onLogout={handleLogout} onNavigate={navigate} />
              ) : route?.id === 'planos' && user ? (
                <PlansPage onNavigate={navigate} />
              ) : route?.id === 'checkout' && user ? (
                <CheckoutPage onNavigate={navigate} />
              ) : route?.id === 'checkout-confirmado' && user ? (
                <CheckoutConfirmationPage onNavigate={navigate} />
              ) : route?.id === 'configuracoes' && user ? (
                <HealthIntegrationsPage userId={user.id} />
              ) : route?.id === 'privacidade' && user ? (
                <PrivacyPage userId={user.id} onLogout={handleLogout} />
              ) : route?.id === 'administracao' && user && role !== 'user' ? (
                <AdminPage />
              ) : route?.id === 'evolucao' && user ? (
                <BodyEvolutionPage userId={user.id} />
              ) : route?.id === 'metas' && user ? (
                <GoalsPage userId={user.id} />
              ) : route?.id === 'relatorios' && user ? (
                <WeeklyReportPage userId={user.id} />
              ) : route?.id === 'assistente' && user ? (
                <FitnessChatPage userId={user.id} />
              ) : route?.id === 'notificacoes' && user ? (
                <NotificationsPage userId={user.id} onNavigate={navigate} />
              ) : route?.id === 'conquistas' && (user || import.meta.env.DEV) ? (
                <AchievementsPage userId={user?.id ?? 'development-preview'} />
              ) : route?.id === 'comunidade' && (user || import.meta.env.DEV) ? (
                <CommunityPage userId={user?.id ?? 'development-preview'} onNavigate={navigate} />
              ) : route?.id === 'perfil-social' && user ? (
                <CommunityProfilePage viewerId={user.id} targetUserId={communityProfileUserId()} onNavigate={navigate} />
              ) : route ? (
                <RoutePlaceholder route={route} onNavigate={navigate} />
              ) : (
                <NotFoundPage onNavigate={() => navigate('/inicio')} />
              )}</Suspense>
              </div>
            </div>
          </main>
        </div>

        <MobileNavigation activeRoute={route?.id} onNavigate={navigate} />
      </div>
    </AppErrorBoundary>
  )
}

function communityProfileUserId() {
  if (typeof window === 'undefined') return ''
  const query = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.search.slice(1)
  return new URLSearchParams(query).get('user') ?? ''
}
