import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

const HOME_URL = 'https://page.roooooyan.work'

/** 右上角「返回主页」入口，在当前页面跳转至主站 */
export function HomeButton() {
  return (
    <Button variant="ghost" size="sm" className="cursor-pointer" asChild>
      <a href={HOME_URL} aria-label="返回主页" title="返回主页">
        <Home className="size-4" />
        <span className="hidden sm:inline">主页</span>
      </a>
    </Button>
  )
}
