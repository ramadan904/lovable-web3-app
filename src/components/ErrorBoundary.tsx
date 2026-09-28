import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'

type Props = { children: ReactNode; label?: string }
type State = { error?: Error }

/**
 * Keeps one broken page or card (e.g. an explorer returning something unexpected)
 * from blanking the whole app. "Try again" re-mounts the children.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunkFailed = /dynamically imported module|Loading chunk|Failed to fetch/i.test(this.state.error.message)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <TriangleAlert className="size-6 text-amber-500" />
        <p className="font-medium">{this.props.label ?? 'This part of the app'} hit a problem.</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {chunkFailed
            ? 'A newer version was probably just deployed. Reload the page to get it.'
            : 'Your funds are safe — nothing was sent. The rest of the app still works.'}
        </p>
        <Button
          variant="outline"
          onClick={() => (chunkFailed ? window.location.reload() : this.setState({ error: undefined }))}
        >
          <RotateCcw /> {chunkFailed ? 'Reload' : 'Try again'}
        </Button>
      </div>
    )
  }
}
