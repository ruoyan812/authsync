import { useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone, Tablet } from 'lucide-react'
import { getDeviceType, type DeviceType } from '@/hooks/useDeviceScale'

const META: Record<DeviceType, { label: string; icon: typeof Smartphone }> = {
  mobile: { label: '手机', icon: Smartphone },
  tablet: { label: '平板', icon: Tablet },
  desktop: { label: '桌面', icon: Monitor },
}

/**
 * 设备适配调试提示：在「适配中」时短暂显示当前设备类型与根字号缩放值，
 * 切换设备类型（手机/平板/桌面）会重新浮现，3 秒后自动隐藏，不打扰正常使用。
 */
export function DeviceScaleDebug() {
  const [device, setDevice] = useState<DeviceType>(() => getDeviceType(window.innerWidth))
  const [fontSize, setFontSize] = useState(16)
  const [visible, setVisible] = useState(true)
  const prevDevice = useRef(device)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    let raf = 0
    const scheduleHide = () => {
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setVisible(false), 3000)
    }
    const update = () => {
      const next = getDeviceType(document.documentElement.clientWidth || window.innerWidth)
      setFontSize(parseFloat(getComputedStyle(document.documentElement).fontSize))
      if (next !== prevDevice.current) {
        prevDevice.current = next
        setDevice(next)
        setVisible(true)
      }
      scheduleHide()
    }
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    update()
    scheduleHide()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hideTimer.current)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  if (!visible) return null
  const { label, icon: Icon } = META[device]
  return (
    <div className="fixed bottom-3 left-3 z-[60] flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur">
      <Icon className="size-3.5" />
      <span>
        适配中：{label} · {fontSize.toFixed(1)}px
      </span>
    </div>
  )
}
