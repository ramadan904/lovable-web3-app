import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useChains, useConnection, useSwitchChain } from 'wagmi'
import { CornerDownLeft, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EXAMPLES, parseCommand, type Command } from '@/lib/command'
import { navigate } from '@/lib/route'
import { fillSendDraft } from '@/lib/sendDraft'
import { setTheme } from '@/lib/theme'

function describe(cmd: Command, chainName: (key?: string) => string | undefined) {
  switch (cmd.kind) {
    case 'send':
      return `Send ${cmd.amount} ${cmd.token} to ${cmd.to}${cmd.chain ? ` on ${chainName(cmd.chain)}` : ''} — you'll review it before signing`
    case 'switch':
      return `Switch network to ${chainName(cmd.chain)}`
    case 'theme':
      return `Turn on ${cmd.theme} mode`
    case 'copy':
      return 'Copy your wallet address'
    case 'receive':
      return 'Show your address and QR code'
    case 'goto':
      return cmd.view === 'gas'
        ? 'Open the live gas tracker'
        : cmd.view === 'watch'
          ? 'Open Whale Watch'
          : cmd.view === 'approvals'
            ? 'Open Approval Guard'
            : cmd.view === 'wrapped'
              ? `Open Wallet Wrapped${cmd.target ? ` for ${cmd.target}` : ''}`
              : 'Open the dashboard'
  }
}

export function CommandBar() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  const chains = useChains()
  const { address, chain, status } = useConnection()
  const switchChain = useSwitchChain()

  const chainByKey = (key?: string) =>
    chains.find((c) => (key === 'ethereum' ? c.id === 1 : c.name.toLowerCase() === key))
  const chainName = (key?: string) => chainByKey(key)?.name ?? key

  function show() {
    setText('')
    setMessage(undefined)
    setOpen(true)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setText('')
        setMessage(undefined)
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const cmd = parseCommand(text)
  const connected = status === 'connected' && !!address
  const needsWallet = cmd && ['send', 'switch', 'copy', 'receive'].includes(cmd.kind) && !connected

  async function run(c: Command) {
    switch (c.kind) {
      case 'send': {
        const target = chainByKey(c.chain)
        if (target && connected && target.id !== chain?.id) switchChain.mutate({ chainId: target.id })
        navigate({ view: 'dashboard' })
        setTimeout(
          () =>
            fillSendDraft({
              to: c.to,
              amount: c.amount,
              token: c.token,
            }),
          50,
        )
        break
      }
      case 'switch':
        switchChain.mutate({ chainId: chainByKey(c.chain)!.id })
        break
      case 'theme':
        setTheme(c.theme)
        break
      case 'copy':
        try {
          await navigator.clipboard.writeText(address!)
        } catch {
          setMessage("Couldn't access the clipboard.")
          return
        }
        break
      case 'receive':
        navigate({ view: 'dashboard' })
        setTimeout(() => document.getElementById('receive')?.scrollIntoView({ behavior: 'smooth' }), 50)
        break
      case 'goto':
        navigate({ view: c.view, target: c.target })
        break
    }
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={show}
        className="text-muted-foreground gap-2"
        aria-label="Open command bar"
      >
        <Search />
        <span className="hidden sm:inline">Type a command</span>
        <kbd className="bg-muted hidden rounded px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </Button>

      {/* Portal: the sticky header's backdrop-filter would otherwise trap this fixed overlay. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div
              role="dialog"
              aria-label="Command bar"
              className="bg-card w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (cmd && !needsWallet) run(cmd)
                }}
                className="flex items-center gap-2 border-b px-4"
              >
                <Search className="text-muted-foreground size-4 shrink-0" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    setMessage(undefined)
                  }}
                  placeholder="send 5 usdc to vitalik.eth on base"
                  className="h-12 flex-1 bg-transparent text-sm outline-none"
                  aria-label="Command"
                  autoComplete="off"
                  spellCheck={false}
                />
              </form>
              <div className="max-h-80 overflow-y-auto p-2 text-sm">
                {text.trim() === '' ? (
                  <>
                    <p className="text-muted-foreground px-2 py-1 text-xs">Try</p>
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => {
                          setText(ex)
                          inputRef.current?.focus()
                        }}
                        className="hover:bg-muted w-full rounded-md px-2 py-2 text-left font-mono text-xs"
                      >
                        {ex}
                      </button>
                    ))}
                  </>
                ) : cmd ? (
                  <button
                    type="button"
                    onClick={() => !needsWallet && run(cmd)}
                    disabled={!!needsWallet}
                    className="bg-muted flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left disabled:opacity-60"
                  >
                    <span>{needsWallet ? 'Connect a wallet first to do that.' : describe(cmd, chainName)}</span>
                    {!needsWallet && <CornerDownLeft className="text-muted-foreground size-4 shrink-0" />}
                  </button>
                ) : (
                  <p className="text-muted-foreground px-2 py-3">
                    Not sure what that means. Try “send 0.01 eth to name.eth on sepolia”.
                  </p>
                )}
                {message && <p className="text-destructive px-2 py-2">{message}</p>}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
