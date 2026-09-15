/**
 * 各类枚举的中文文案，页面共用，避免每页各写一份。
 */
import type { ApiScope, AuditType, Capability, ModuleKey, ReportChannel, WebhookEvent } from './types'

export const AUDIT_LABEL: Record<AuditType, string> = {
  login: '登录',
  login_failed: '登录失败',
  logout: '登出',
  'staff.create': '创建员工',
  'staff.update': '修改员工',
  'staff.disable': '停用/激活员工',
  'staff.reset_password': '重置密码',
  'staff.force_logout': '强制下线',
  'role.create': '创建角色',
  'role.update': '修改角色',
  'role.delete': '删除角色',
  'seat.create': '创建坐席',
  'seat.update': '修改坐席',
  'seat.handover': '坐席交接',
  'seat.pause': '暂停接新',
  'seat_group.update': '坐席组',
  'invite_group.create': '创建邀请组',
  'invite_group.update': '修改邀请组',
  'invite_group.reset_code': '重置邀请码',
  'invite_group.backfill': '补加到已有客户',
  'invite_link.create': '创建邀请链接',
  'invite_link.revoke': '失效邀请链接',
  'title.assign': '挂头衔',
  'title.remove': '摘头衔',
  'title.library': '头衔库',
  'tag.library': '内部标签库',
  'policy.update': '策略',
  'policy.preset': '应用策略预设',
  'policy.cap': '修改能力',
  'policy.number': '修改数值策略',
  'policy.override': '用户级覆盖',
  'group.official': '标记官方群',
  'group.update': '修改群',
  'settings.update': '企业设置',
  'module.toggle': '模块启停',
  'customer.register': '客户注册',
  'customer.reassign': '改主归属',
  'customer.delete': '注销客户',
  'broadcast.send': '群发',
  'message.delete': '删除消息',
  'report.handle': '处理举报',
  'sensitive.update': '敏感词',
  export: '导出数据',
  'wallet.settings': '钱包设置',
  'wallet.adjust': '手动加减积分',
  'wallet.withdrawal': '提现审核',
  'checkin.settings': '签到规则',
  'referral.settings': '推荐奖励规则',
  'referral.cancel': '取消推荐奖励',
  'banner.update': '横幅',
  'announcement.update': '公告',
  'ai.settings': 'AI 设置',
  'knowledge.update': '知识库',
  'profile.sync': '画像同步设置',
  'profile.import': 'CSV 导入',
  'automation.update': '自动化规则',
  'daily_report.settings': '日报设置',
  'plugin.update': '插件',
  'api_key.create': '创建 API Key',
  'api_key.delete': '删除 API Key',
  'webhook.update': 'Webhook',
  'app_version.update': 'App 版本',
  'license.upload': '上传许可',
  'backup.run': '备份',
  'backup.restore': '恢复',
}

export const MODULE_LABEL: Record<ModuleKey, { name: string; desc: string; level: 'P0' | 'P1' | 'P2' }> = {
  customers: { name: '客户管理', desc: '客户列表、头衔与内部标签、备注、画像', level: 'P0' },
  invite: { name: '邀请与分配', desc: '邀请组、邀请链接、注册即分配', level: 'P0' },
  wallet: { name: '钱包', desc: '积分、提现审核、收款账户', level: 'P2' },
  checkin: { name: '签到', desc: '每日签到领积分', level: 'P2' },
  referral: { name: '推荐奖励', desc: '转介绍奖励与异常检测', level: 'P2' },
  broadcast: { name: '群发', desc: '以坐席身份定向群发', level: 'P0' },
  banner: { name: '公告与横幅', desc: '客户 App 首页横幅与启动公告', level: 'P0' },
  content: { name: '内容管控', desc: '敏感词、举报处理', level: 'P1' },
}

export interface CapabilityMeta {
  key: Capability
  cat: string
  desc: string
  level: 'P0' | 'P1' | 'P2'
}

/** 员工角色的权限清单，顺序与 PRD 05 一致 */
export const CAPABILITIES: CapabilityMeta[] = [
  { cat: '会话访问', key: 'view_all_conversations', desc: '查看全部会话；关闭时仅看本人持有坐席的会话', level: 'P0' },
  { cat: '工作台', key: 'view_all_customers', desc: '查看全部客户；关闭时仅看本人持有坐席主归属的客户', level: 'P0' },
  { cat: '工作台', key: 'create_invite', desc: '生成邀请链接', level: 'P0' },
  { cat: '工作台', key: 'broadcast', desc: '群发消息', level: 'P0' },
  { cat: '工作台', key: 'manage_groups', desc: '管理所有群', level: 'P0' },
  { cat: '工作台', key: 'view_audit', desc: '查看消息审计', level: 'P0' },
  { cat: '工作台', key: 'view_seat_operator', desc: '查看坐席背后的实操员工与交接记录；关闭时只看得到坐席身份', level: 'P0' },
  { cat: '工作台', key: 'assign_title', desc: '给客户挂、摘头衔（只能从头衔库选）', level: 'P0' },
  { cat: '工作台', key: 'export_customers', desc: '导出客户列表', level: 'P1' },
  { cat: '工作台', key: 'delete_user', desc: '注销客户账号', level: 'P1' },
  { cat: '钱包', key: 'review_withdrawal', desc: '审核提现', level: 'P2' },
  { cat: '钱包', key: 'mark_paid', desc: '标记已打款', level: 'P2' },
  { cat: '钱包', key: 'adjust', desc: '手动加减积分', level: 'P2' },
  { cat: '管理后台', key: 'manage_seats', desc: '管理坐席与坐席交接', level: 'P0' },
  { cat: '管理后台', key: 'manage_titles', desc: '维护内部标签库与头衔库', level: 'P0' },
  { cat: '管理后台', key: 'manage_staff', desc: '管理员工账号', level: 'P0' },
  { cat: '管理后台', key: 'manage_roles', desc: '管理员工角色', level: 'P0' },
  { cat: '管理后台', key: 'manage_policies', desc: '管理策略', level: 'P0' },
  { cat: '管理后台', key: 'manage_settings', desc: '管理企业设置', level: 'P0' },
  { cat: '管理后台', key: 'view_audit_logs', desc: '查看审计日志', level: 'P0' },
  { cat: '管理后台', key: 'export_data', desc: '导出数据', level: 'P1' },
]

export const API_SCOPE_LABEL: Record<ApiScope, string> = {
  read_customers: '读客户',
  write_customers: '写客户',
  read_messages: '读消息',
  send_messages: '发消息',
  manage_groups: '管理群',
  read_stats: '读统计',
}

export const WEBHOOK_EVENT_LABEL: Record<WebhookEvent, string> = {
  message_created: '新消息',
  conversation_created: '新会话',
  user_registered: '客户注册',
  title_assigned: '挂头衔',
  purchase_synced: '购买记录同步',
}

export const REPORT_CHANNEL_LABEL: Record<ReportChannel, { name: string; level: 'P0' | 'P1' | 'P2' }> = {
  app: { name: 'App 推送', level: 'P0' },
  wecom: { name: '企微机器人', level: 'P0' },
  feishu: { name: '飞书机器人', level: 'P0' },
  wechat: { name: '微信服务号', level: 'P1' },
  sms: { name: '短信', level: 'P2' },
  email: { name: '邮件', level: 'P2' },
}

export const THEME_LABEL: Record<string, string> = { classic: '经典蓝', dark: '深色', ocean: '海洋', warm: '暖色' }
