import { useEffect } from 'react'
import { AppUpdateBanner, CurseForgeMissingBanner, OfflineBanner, ShortcutBanner } from './components/Banners'
import { DetailsPanel } from './components/DetailsPanel'
import { Hero } from './components/Hero'
import { ModpackCard } from './components/ModpackCard'
import { SettingsDialog } from './components/SettingsDialog'
import { EmptyView, ErrorView, LoadingView } from './components/States'
import { TitleBar } from './components/TitleBar'
import { Toasts } from './components/Toasts'
import { useStore } from './store'

function Library() {
  const catalog = useStore((s) => s.catalog)
  const loading = useStore((s) => s.loading)

  if (loading && !catalog) return <LoadingView />
  if (!catalog) return <ErrorView message="Réessaie dans un instant." />
  if (catalog.modpacks.length === 0) {
    return catalog.error ? <ErrorView message={catalog.error} /> : <EmptyView />
  }

  const [featured, ...others] = catalog.modpacks
  return (
    <>
      <Hero modpack={featured} />
      {others.length > 0 && (
        <section className="px-8 pt-12 pb-16">
          <div className="mb-6 flex items-baseline gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight">Autres modpacks</h2>
            <span className="text-sm text-ink-400">{others.length}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
            {others.map((modpack, index) => (
              <ModpackCard key={modpack.id} modpack={modpack} index={index} />
            ))}
          </div>
        </section>
      )}
      {others.length === 0 && <div className="h-16" />}
    </>
  )
}

export function App() {
  const init = useStore((s) => s.init)
  const refreshLocal = useStore((s) => s.refreshLocal)

  useEffect(() => {
    void init()
    // Si l'utilisateur supprime un profil dans CurseForge, on le voit au retour sur la fenêtre.
    const onFocus = () => void refreshLocal()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [init, refreshLocal])

  return (
    <div className="relative flex h-full flex-col">
      <div className="pointer-events-none fixed inset-0">
        <div className="pixel-grid absolute inset-0" />
        <div className="absolute -top-40 -left-40 size-[640px] rounded-full bg-grass-500/[0.07] blur-[120px]" />
        <div className="absolute -right-40 -bottom-60 size-[720px] rounded-full bg-sky-500/[0.05] blur-[140px]" />
      </div>

      <TitleBar />
      <main className="relative flex-1 overflow-y-auto">
        <AppUpdateBanner />
        <CurseForgeMissingBanner />
        <OfflineBanner />
        <ShortcutBanner />
        <Library />
      </main>

      <DetailsPanel />
      <SettingsDialog />
      <Toasts />
    </div>
  )
}
