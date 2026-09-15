import { useStore } from '@/store/store'
import { seatsOfStaff, staffById, staffHasCap } from '@/store/selectors'

/** 工作台当前登录员工与当前坐席身份 */
export function useWorkbench() {
  const s = useStore()
  const staff = staffById(s, s.session.workbenchStaffId)
  const mySeats = seatsOfStaff(s, s.session.workbenchStaffId)
  const seat = mySeats.find((x) => x.id === s.session.workbenchSeatId) ?? mySeats[0]
  const can = (cap: string) => staffHasCap(s, staff?.id ?? null, cap)
  return { s, staff, seat, mySeats, can }
}
