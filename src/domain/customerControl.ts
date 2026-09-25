/**
 * 客户管控动作的共用文案与选项。
 *
 * 同一个动作在工作台（资料卡「更多」菜单）和管理后台（客户详情）各有一套界面，
 * 但确认框里对客户说的话必须一字不差——两处写两遍，改了一处忘了另一处，
 * 演示时就会出现"后台说会移出所有群、工作台说不会"这种自相矛盾。
 */

export const MUTE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '1 小时', hours: 1 },
  { label: '24 小时', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '永久', hours: null },
]

export const CONTROL_COPY = {
  resetPassword: '生成一次性新密码，只显示一次；客户首次登录时必须修改。',
  password: '只显示这一次，关闭后不能再查看。客户用它登录后会被强制修改密码。',
  banOn: '封禁后账号无法登录，所有已登录设备会退出。群发不再投递给该客户。',
  banOff: '解除后客户可以重新登录。',
  muteAllGroups: '群聊禁言期间，客户不能在任何群或频道发送消息；仍可向坐席私聊。单个群的禁言在群信息里设置。',
  muteGlobal: '全部禁言期间，客户不能向任何坐席、群或频道发送消息。',
  forceLogout: '立即让该客户的所有设备退出登录。账号仍可用原密码重新登录，不影响消息。',
  shadowOn: '开启后他在群里发的每条消息，只有他自己和坐席看得见，其他客户完全看不到。客户端没有任何提示，他会以为消息正常发出去了。适合已经确认在拉人、发广告，但还不想打草惊蛇的号。',
  shadowOff: '关闭后他之后发的消息恢复正常可见。影子期间发的那些消息仍然不对其他客户显示，不会突然集体冒出来。',
  delete: '账号不再出现在工作台，从所有群移出；数据保留供审计。此操作不可撤销。',
} as const

export function muteLabel(hours: number | null): string {
  return hours == null ? '永久' : `${hours} 小时`
}
