import { lazy, Suspense, type ReactElement, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  DashboardPageSkeleton,
  DelegateProfileSkeleton,
  RoundsPageSkeleton,
  TransparencyPageSkeleton,
  VotersPageSkeleton,
} from '@/components/shared/PageSkeletons'
import { LandingPage } from '@/pages/LandingPage'

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const VotersPage = lazy(() => import('@/pages/VotersPage').then((module) => ({ default: module.VotersPage })))
const VoterProfilePage = lazy(() => import('@/pages/VoterProfilePage').then((module) => ({ default: module.VoterProfilePage })))
const RoundsPage = lazy(() => import('@/pages/RoundsPage').then((module) => ({ default: module.RoundsPage })))
const RoundDetailPage = lazy(() => import('@/pages/RoundsPage/RoundDetailPage').then((module) => ({ default: module.RoundDetailPage })))
const TransparencyPage = lazy(() => import('@/pages/TransparencyPage').then((module) => ({ default: module.TransparencyPage })))
const GriffPage = lazy(() => import('@/pages/GriffPage').then((module) => ({ default: module.GriffPage })))

function LazyPage({ children, fallback }: { children: ReactNode; fallback?: ReactElement }) {
  return (
    <Suspense fallback={fallback ?? <DashboardPageSkeleton />}>
      {children}
    </Suspense>
  )
}

export function Router() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="dashboard" element={<LazyPage><DashboardPage /></LazyPage>} />
        <Route path="voters" element={<LazyPage fallback={<VotersPageSkeleton />}><VotersPage /></LazyPage>} />
        <Route path="voters/:address" element={<LazyPage fallback={<DelegateProfileSkeleton />}><VoterProfilePage /></LazyPage>} />
        <Route path="rounds/:roundNumber" element={<LazyPage><RoundDetailPage /></LazyPage>} />
        <Route path="rounds" element={<LazyPage fallback={<RoundsPageSkeleton />}><RoundsPage /></LazyPage>} />
        <Route path="transparency" element={<LazyPage fallback={<TransparencyPageSkeleton />}><TransparencyPage /></LazyPage>} />
        <Route path="griff" element={<LazyPage><GriffPage /></LazyPage>} />
        {/* Holder share links are crawler-only (OG tags via api/holder-html);
            humans who open one land on the campaign. */}
        <Route path="share/holder/:address" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
