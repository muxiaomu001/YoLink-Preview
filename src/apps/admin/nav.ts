/**
 * 管理后台导航：分组、层级标记（P0/P1/P2）、模块启停控制显隐。
 * 顺序与 docs/prd/05 章节一致。
 */
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BadgeCheck,
  Bell,
  Blocks,
  Bot,
  Building2,
  CalendarCheck,
  ClipboardList,
  Coins,
  Database,
  Download,
  FileKey2,
  FileSearch,
  Flag,
  Gauge,
  Gift,
  HardDriveDownload,
  Image,
  KeyRound,
  LineChart,
  Link2,
  MessageSquareQuote,
  Puzzle,
  ScrollText,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tags,
  UserCog,
  UserRound,
  UserSearch,
  Users,
  UsersRound,
  Webhook,
} from 'lucide-react'
import type { ModuleKey } from '@/domain/types'

export type Level = 'P0' | 'P1' | 'P2'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  level?: Level
  /** 只有该模块启用时才显示 */
  module?: ModuleKey
  /** 演示专属页：关掉演示批注后不出现，正式产品没有这一页 */
  demoOnly?: boolean
}

export interface NavGroup {
  group: string
  items: NavItem[]
}

export const ADMIN_NAV: NavGroup[] = [
  {
    group: '经营',
    items: [
      { to: '/admin/home', label: '经营首页', icon: Gauge },
      { to: '/admin/daily-report', label: '日报与提醒', icon: Bell },
      { to: '/admin/demo-data', label: '演示数据', icon: Sparkles, demoOnly: true },
    ],
  },
  {
    group: '客户',
    items: [
      { to: '/admin/customers', label: '客户列表', icon: UserRound, module: 'customers' },
      { to: '/admin/profile-sync', label: '客户画像', icon: UserSearch, module: 'customers' },
    ],
  },
  {
    group: '坐席、员工与角色',
    items: [
      { to: '/admin/seats', label: '坐席', icon: BadgeCheck },
      { to: '/admin/staff', label: '员工账号', icon: UserCog },
      { to: '/admin/roles', label: '员工角色', icon: ShieldCheck },
    ],
  },
  {
    group: '邀请与分配',
    items: [
      { to: '/admin/invite-groups', label: '邀请组', icon: UsersRound, module: 'invite' },
      { to: '/admin/invite-links', label: '邀请链接总览', icon: Link2, module: 'invite' },
      { to: '/admin/broadcasts', label: '群发管理', icon: Send, module: 'broadcast' },
      { to: '/admin/quick-replies', label: '话术库', icon: MessageSquareQuote, module: 'broadcast' },
    ],
  },
  {
    group: '内部标签与头衔',
    items: [
      { to: '/admin/titles', label: '头衔库', icon: Tags },
      { to: '/admin/tags', label: '内部标签库', icon: Tags },
    ],
  },
  {
    group: '策略',
    items: [{ to: '/admin/policies', label: '策略与能力开关', icon: KeyRound }],
  },
  {
    group: '群与频道',
    items: [{ to: '/admin/groups', label: '全部群列表', icon: Users }],
  },
  {
    group: '内容与审计',
    items: [
      { to: '/admin/message-audit', label: '消息审计', icon: FileSearch },
      { to: '/admin/reports', label: '举报处理', icon: Flag, level: 'P1', module: 'content' },
      { to: '/admin/sensitive-words', label: '敏感词', icon: ShieldAlert, level: 'P1', module: 'content' },
      { to: '/admin/audit-log', label: '审计日志', icon: ClipboardList },
      { to: '/admin/security-log', label: '安全日志', icon: ScrollText, level: 'P1' },
    ],
  },
  {
    group: '数据',
    items: [
      { to: '/admin/stats', label: '基础统计', icon: LineChart, level: 'P1' },
      { to: '/admin/exports', label: '导出', icon: Download, level: 'P1' },
    ],
  },
  {
    group: '模块',
    items: [
      { to: '/admin/modules', label: '模块启停', icon: Blocks },
      { to: '/admin/wallet', label: '钱包', icon: Coins, level: 'P2', module: 'wallet' },
      { to: '/admin/checkin', label: '签到', icon: CalendarCheck, level: 'P2', module: 'checkin' },
      { to: '/admin/referral', label: '推荐奖励', icon: Gift, level: 'P2', module: 'referral' },
      { to: '/admin/banners', label: '公告与横幅', icon: Image, module: 'banner' },
    ],
  },
  {
    group: 'AI',
    items: [{ to: '/admin/ai', label: 'AI 模块', icon: Bot }],
  },
  {
    group: '插件',
    items: [
      { to: '/admin/plugins', label: '插件', icon: Puzzle, level: 'P1' },
      { to: '/admin/api-keys', label: '开放 API 凭据', icon: FileKey2, level: 'P1' },
      { to: '/admin/webhooks', label: 'Webhook', icon: Webhook, level: 'P1' },
    ],
  },
  {
    group: '系统',
    items: [
      { to: '/admin/settings', label: '企业设置', icon: Building2 },
      { to: '/admin/app-versions', label: 'App 版本管理', icon: Smartphone },
      { to: '/admin/license', label: '版本与许可', icon: Database },
      { to: '/admin/backups', label: '备份与恢复', icon: HardDriveDownload },
      { to: '/admin/health', label: '健康状态', icon: Activity, level: 'P1' },
    ],
  },
]
