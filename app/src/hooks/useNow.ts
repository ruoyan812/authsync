import { useEffect, useState } from 'react'

/** 每 intervalMs 毫秒返回一次当前时间戳，用于驱动 TOTP 倒计时刷新 */
export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
