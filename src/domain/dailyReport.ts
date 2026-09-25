import type { DemoState, ReportRecipient } from './types'
import { REPORT_CHANNEL_LABEL } from './labels'

export function dailyReportRecipients(state: DemoState): ReportRecipient[] {
  return state.dailyReport.recipients.flatMap((recipient) => {
    const staff = state.staff.find((member) => member.id === recipient.staffId && member.roleId === 'role_super' && member.status === 'active')
    const channels = recipient.channels.filter((channel) => REPORT_CHANNEL_LABEL[channel]?.level === 'P0')
    return staff && channels.length ? [{ ...recipient, name: staff.name, channels }] : []
  })
}
