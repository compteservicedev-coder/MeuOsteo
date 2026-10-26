import { MotionConfig } from 'framer-motion'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ToastProvider } from './components/toast/ToastProvider'
import { AccessGate } from './features/access/AccessGate'
import { AidePage } from './routes/AidePage'
import { DashboardPage } from './routes/DashboardPage'
import { FichePage } from './routes/FichePage'
import { FacturesPage } from './routes/FacturesPage'
import { ParametresPage } from './routes/ParametresPage'
import { PatientsPage } from './routes/PatientsPage'
import { PlanningPage } from './routes/PlanningPage'

// Hash routing: the renderer is loaded from a file:// URL in the installed app.
const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/planning" replace /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'patients', element: <PatientsPage /> },
      { path: 'patients/:id', element: <FichePage /> },
      { path: 'factures', element: <FacturesPage /> },
      { path: 'tableau-de-bord', element: <DashboardPage /> },
      { path: 'parametres', element: <ParametresPage /> },
      { path: 'aide', element: <AidePage /> },
      { path: '*', element: <Navigate to="/planning" replace /> },
    ],
  },
])

export function App() {
  return (
    // `reducedMotion="user"`: Framer keeps only fades when prefers-reduced-motion is set.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AccessGate>
          <RouterProvider router={router} />
        </AccessGate>
      </ToastProvider>
    </MotionConfig>
  )
}
