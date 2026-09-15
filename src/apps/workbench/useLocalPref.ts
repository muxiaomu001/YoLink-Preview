/**
 * 工作台的本机界面偏好（栏宽、右栏是否收起、折叠区块状态）：只存 localStorage，不进业务 store，不同步到服务端。
 */
import { useCallback, useState } from 'react'

const PREFIX = 'yolink-wb-ui:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function useLocalPref<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(v))
        } catch {
          // 隐私模式等写不进去时静默，界面仍然可用
        }
        return v
      })
    },
    [key],
  )
  return [value, update]
}
