import { useEffect } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export function getDeviceType(width: number): DeviceType {
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

const BASELINE_WIDTH = 1280
const BASE_FONT = 16
const MIN_FONT = 13
const MAX_FONT = 18
const MIN_RATIO = 0.82
const MAX_RATIO = 1.12

/**
 * 根据视口宽度自动计算 <html> 根字号，使整页 UI（基于 rem 的间距、字号、圆角）
 * 随设备等比缩放，并把设备类型写入 data-device 属性，方便针对设备做样式微调。
 *
 * 设计基准：1280px 对应 16px 根字号；更窄的设备等比缩小、更宽的设备等比放大，
 * 结果夹在 [13px, 18px] 之间。监听 resize / orientationchange 实时更新。
 */
export function useDeviceScale() {
  useEffect(() => {
    const root = document.documentElement
    let raf = 0

    const apply = () => {
      const width = root.clientWidth || window.innerWidth
      root.setAttribute('data-device', getDeviceType(width))

      const ratio = width / BASELINE_WIDTH
      const clampedRatio = Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO)
      const size = Math.min(Math.max(BASE_FONT * clampedRatio, MIN_FONT), MAX_FONT)
      root.style.fontSize = `${size.toFixed(2)}px`
    }

    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])
}
