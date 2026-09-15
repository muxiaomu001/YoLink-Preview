import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import { Toaster } from '@/ui/overlay'
import { Landing } from '@/apps/landing/Landing'
import { AdminLayout } from '@/apps/admin/AdminLayout'
import { AdminHome } from '@/apps/admin/pages/AdminHome'
import { SeatsPage } from '@/apps/admin/pages/SeatsPage'
import { StaffPage } from '@/apps/admin/pages/StaffPage'
import { RolesPage } from '@/apps/admin/pages/RolesPage'
import { InviteGroupsPage } from '@/apps/admin/pages/InviteGroupsPage'
import { InviteLinksPage } from '@/apps/admin/pages/InviteLinksPage'
import { TitlesPage } from '@/apps/admin/pages/TitlesPage'
import { TagsPage } from '@/apps/admin/pages/TagsPage'
import { PoliciesPage } from '@/apps/admin/pages/PoliciesPage'
import { MessageAuditPage } from '@/apps/admin/pages/MessageAuditPage'
import { AuditLogPage } from '@/apps/admin/pages/AuditLogPage'
import { ChatGroupsPage } from '@/apps/admin/pages/ChatGroupsPage'
import { SettingsPage } from '@/apps/admin/pages/SettingsPage'
import { WorkbenchLayout } from '@/apps/workbench/WorkbenchLayout'
import { ChatPage } from '@/apps/workbench/pages/ChatPage'
import { CustomersPage } from '@/apps/workbench/pages/CustomersPage'
import { InvitesPage } from '@/apps/workbench/pages/InvitesPage'
import { BroadcastPage } from '@/apps/workbench/pages/BroadcastPage'
import { WbSettingsPage } from '@/apps/workbench/pages/WbSettingsPage'
import { PhoneApp } from '@/apps/phone/PhoneApp'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/home" replace /> },
      { path: 'home', element: <AdminHome /> },
      { path: 'seats', element: <SeatsPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'invite-groups', element: <InviteGroupsPage /> },
      { path: 'invite-links', element: <InviteLinksPage /> },
      { path: 'titles', element: <TitlesPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'policies', element: <PoliciesPage /> },
      { path: 'groups', element: <ChatGroupsPage /> },
      { path: 'message-audit', element: <MessageAuditPage /> },
      { path: 'audit-log', element: <AuditLogPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '/workbench',
    element: <WorkbenchLayout />,
    children: [
      { index: true, element: <Navigate to="/workbench/chat" replace /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat/:convId', element: <ChatPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'invites', element: <InvitesPage /> },
      { path: 'broadcast', element: <BroadcastPage /> },
      { path: 'settings', element: <WbSettingsPage /> },
    ],
  },
  { path: '/phone', element: <PhoneApp /> },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
  </StrictMode>,
)
