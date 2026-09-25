import { StrictMode } from 'react'
import { Bot, Sparkles } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import { Toaster } from '@/ui/overlay'
import { Confirmer } from '@/ui/confirm'
import { Lightbox } from '@/ui/media'
import { Landing } from '@/apps/landing/Landing'
import { AdminLayout } from '@/apps/admin/AdminLayout'
import { AdminHome } from '@/apps/admin/pages/AdminHome'
import { DailyReportPage } from '@/apps/admin/pages/DailyReportPage'
import { DemoDataPage } from '@/apps/admin/pages/DemoDataPage'
import { CustomersAdminPage } from '@/apps/admin/pages/CustomersAdminPage'
import { ProfileSyncPage } from '@/apps/admin/pages/ProfileSyncPage'
import { SeatsPage } from '@/apps/admin/pages/SeatsPage'
import { StaffPage } from '@/apps/admin/pages/StaffPage'
import { RolesPage } from '@/apps/admin/pages/RolesPage'
import { InviteGroupsPage } from '@/apps/admin/pages/InviteGroupsPage'
import { InviteLinksPage } from '@/apps/admin/pages/InviteLinksPage'
import { BroadcastsAdminPage } from '@/apps/admin/pages/BroadcastsAdminPage'
import { QuickRepliesPage } from '@/apps/admin/pages/QuickRepliesPage'
import { TitlesPage } from '@/apps/admin/pages/TitlesPage'
import { TagsPage } from '@/apps/admin/pages/TagsPage'
import { PoliciesPage } from '@/apps/admin/pages/PoliciesPage'
import { ChatGroupsPage } from '@/apps/admin/pages/ChatGroupsPage'
import { ChatGroupDetailPage } from '@/apps/admin/pages/ChatGroupDetailPage'
import { MessageAuditPage } from '@/apps/admin/pages/MessageAuditPage'
import { ReportsPage } from '@/apps/admin/pages/ReportsPage'
import { SensitiveWordsPage } from '@/apps/admin/pages/SensitiveWordsPage'
import { AuditLogPage } from '@/apps/admin/pages/AuditLogPage'
import { SecurityLogPage } from '@/apps/admin/pages/SecurityLogPage'
import { StatsPage } from '@/apps/admin/pages/StatsPage'
import { ExportsPage } from '@/apps/admin/pages/ExportsPage'
import { ModulesPage } from '@/apps/admin/pages/ModulesPage'
import { WalletPage } from '@/apps/admin/pages/WalletPage'
import { CheckinPage } from '@/apps/admin/pages/CheckinPage'
import { ReferralPage } from '@/apps/admin/pages/ReferralPage'
import { BannersPage } from '@/apps/admin/pages/BannersPage'
import { DemoPendingRoute } from '@/ui/DemoPendingModule'
import { PluginsPage } from '@/apps/admin/pages/PluginsPage'
import { ApiKeysPage } from '@/apps/admin/pages/ApiKeysPage'
import { WebhooksPage } from '@/apps/admin/pages/WebhooksPage'
import { SettingsPage } from '@/apps/admin/pages/SettingsPage'
import { AppVersionsPage } from '@/apps/admin/pages/AppVersionsPage'
import { LicensePage } from '@/apps/admin/pages/LicensePage'
import { BackupsPage } from '@/apps/admin/pages/BackupsPage'
import { HealthPage } from '@/apps/admin/pages/HealthPage'
import { WorkbenchLayout } from '@/apps/workbench/WorkbenchLayout'
import { ChatPage } from '@/apps/workbench/pages/ChatPage'
import { CustomersPage } from '@/apps/workbench/pages/CustomersPage'
import { InvitesPage } from '@/apps/workbench/pages/InvitesPage'
import { BroadcastPage } from '@/apps/workbench/pages/BroadcastPage'
import { WbSettingsPage } from '@/apps/workbench/pages/WbSettingsPage'
import { WithdrawalsPage } from '@/apps/workbench/pages/WithdrawalsPage'
import { PhoneApp } from '@/apps/phone/PhoneApp'
import { ProviderApp } from '@/apps/provider/ProviderApp'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/home" replace /> },
      // 经营
      { path: 'home', element: <AdminHome /> },
      { path: 'daily-report', element: <DailyReportPage /> },
      { path: 'demo-data', element: <DemoDataPage /> },
      // 客户
      { path: 'customers', element: <CustomersAdminPage /> },
      { path: 'profile-sync', element: <ProfileSyncPage /> },
      // 坐席、员工与角色
      { path: 'seats', element: <SeatsPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'roles', element: <RolesPage /> },
      // 邀请与分配
      { path: 'invite-groups', element: <InviteGroupsPage /> },
      { path: 'invite-links', element: <InviteLinksPage /> },
      { path: 'broadcasts', element: <BroadcastsAdminPage /> },
      { path: 'quick-replies', element: <QuickRepliesPage /> },
      // 内部标签与头衔
      { path: 'titles', element: <TitlesPage /> },
      { path: 'tags', element: <TagsPage /> },
      // 策略
      { path: 'policies', element: <PoliciesPage /> },
      // 群与频道
      { path: 'groups', element: <ChatGroupsPage /> },
      { path: 'groups/:groupId', element: <ChatGroupDetailPage /> },
      // 内容与审计
      { path: 'message-audit', element: <MessageAuditPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'sensitive-words', element: <SensitiveWordsPage /> },
      { path: 'audit-log', element: <AuditLogPage /> },
      { path: 'security-log', element: <SecurityLogPage /> },
      // 数据
      { path: 'stats', element: <StatsPage /> },
      { path: 'exports', element: <ExportsPage /> },
      // 模块
      { path: 'modules', element: <ModulesPage /> },
      { path: 'wallet', element: <WalletPage /> },
      { path: 'checkin', element: <CheckinPage /> },
      { path: 'referral', element: <ReferralPage /> },
      { path: 'banners', element: <BannersPage /> },
      // AI
      { path: 'ai', element: <DemoPendingRoute home="/admin/home" icon={Sparkles} title="AI 模块 · 独立板块，待设计" lines={[
        '回复推荐、知识库、AI 写文案等能力，将整合公司现有的 AI 产品，不在 YoLink 里另起一套。',
        '接在哪、放在哪、谁能用，都还没设计。这里只占个位置，说明将来有这个板块。',
      ]} /> },
      // 插件
      { path: 'plugins', element: <PluginsPage /> },
      { path: 'api-keys', element: <ApiKeysPage /> },
      { path: 'webhooks', element: <WebhooksPage /> },
      // 系统
      { path: 'settings', element: <SettingsPage /> },
      { path: 'app-versions', element: <AppVersionsPage /> },
      { path: 'license', element: <LicensePage /> },
      { path: 'backups', element: <BackupsPage /> },
      { path: 'health', element: <HealthPage /> },
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
      { path: 'bots', element: <DemoPendingRoute home="/workbench/chat" icon={Bot} title="群活跃助手 · 独立板块，待设计" lines={[
        '以真人身份参与群聊、带动气氛的能力，将整合公司现有产品。',
        '触发条件、发言节奏、审核方式都还没设计。这里只占个位置，说明将来有这个板块。',
      ]} /> },
      { path: 'withdrawals', element: <WithdrawalsPage /> },
    ],
  },
  { path: '/phone', element: <PhoneApp /> },
  { path: '/provider', element: <ProviderApp /> },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
    <Confirmer />
    <Lightbox />
  </StrictMode>,
)
