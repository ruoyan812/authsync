import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Loader2, RefreshCw, SwitchCamera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { tryExtractFromImage } from '@/lib/totp'
import type { ParsedOtpauth } from '@/lib/totp'

interface Props {
  onDetected: (parsed: ParsedOtpauth) => void
}

/**
 * 摄像头扫码：打开摄像头实时预览并自动识别二维码，
 * 也支持手动点击拍照识别。组件卸载时自动释放摄像头。
 */
export function CameraScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const onDetectedRef = useRef(onDetected)

  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')

  // 用 ref 持有回调，避免父组件重渲染导致扫描定时器反复重建
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) video.srcObject = null
    setReady(false)
  }, [])

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopCamera()
      setError('')
      setBusy(true)
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('unsupported')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false,
        })
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setReady(true)
      } catch {
        setError('无法访问摄像头，请检查浏览器权限，或改用截图 / 手动输入')
      } finally {
        setBusy(false)
      }
    },
    [stopCamera],
  )

  // 挂载时开启摄像头；切换前后摄时重启；卸载时释放
  useEffect(() => {
    startCamera(facing)
    return () => stopCamera()
  }, [facing, startCamera, stopCamera])

  /** 抓取当前视频帧并尝试识别二维码 */
  const grab = useCallback(async (): Promise<ParsedOtpauth | null> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) return null
    return tryExtractFromImage(blob)
  }, [])

  // 实时扫描：每 600ms 自动尝试识别一帧，识别成功即回调并释放摄像头
  useEffect(() => {
    if (!ready) return
    const timer = setInterval(async () => {
      if (scanningRef.current) return
      scanningRef.current = true
      try {
        const parsed = await grab()
        if (parsed) {
          stopCamera()
          onDetectedRef.current(parsed)
        }
      } finally {
        scanningRef.current = false
      }
    }, 600)
    return () => clearInterval(timer)
  }, [ready, grab, stopCamera])

  async function handleCapture() {
    if (!ready) return
    setBusy(true)
    setError('')
    try {
      const parsed = await grab()
      if (!parsed) {
        setError('未识别到二维码，请对准并调整距离 / 光线后重试')
        return
      }
      stopCamera()
      onDetectedRef.current(parsed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          autoPlay
          playsInline
          muted
        />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
            {busy ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Camera className="size-6" />
            )}
            <span>{busy ? '正在启动摄像头…' : '摄像头未开启'}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          className="flex-1 cursor-pointer"
          onClick={handleCapture}
          disabled={!ready || busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          拍照识别
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="cursor-pointer"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          aria-label="切换摄像头"
          title="切换前后摄像头"
        >
          <SwitchCamera className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="cursor-pointer"
          onClick={() => startCamera(facing)}
          aria-label="重启摄像头"
          title="重启摄像头"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        将二维码对准取景框，识别成功后会自动填充
      </p>
    </div>
  )
}
