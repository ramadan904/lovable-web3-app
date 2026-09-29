import type { Address } from 'viem'
import { FileDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Approval } from '@/lib/approvals'
import { buildReport, downloadText, reportHtml } from '@/lib/securityReport'
import { useWalletHealth } from '@/lib/useWalletHealth'

/** Downloads the Guard results for one chain as a printable HTML page or JSON. */
export function ExportReport({
  address,
  chainId,
  chainName,
  explorer,
  approvals,
  approvalsFromHoldings,
}: {
  address: Address
  chainId: number
  chainName: string
  explorer?: string
  approvals: Approval[] | undefined
  approvalsFromHoldings: boolean
}) {
  const { health, attempts, spamTokens, partial } = useWalletHealth(address, chainId, approvals)
  const ready = !!health && !!approvals

  function save(format: 'html' | 'json') {
    if (!health || !approvals) return
    const report = buildReport({
      address,
      chainId,
      chainName,
      explorer,
      health,
      approvals,
      attempts,
      spamTokens,
      partial,
      approvalsFromHoldings,
    })
    const name = `wallet-security-report-${address.slice(0, 8)}-${chainName.toLowerCase().replace(/\W+/g, '-')}-${report.generatedAt.slice(0, 10)}`
    if (format === 'html') downloadText(`${name}.html`, reportHtml(report, explorer), 'text/html')
    else downloadText(`${name}.json`, JSON.stringify(report, null, 2), 'application/json')
  }

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => save('html')} disabled={!ready} title="Printable report">
        <FileDown /> Export security report
      </Button>
      <Button size="sm" variant="ghost" onClick={() => save('json')} disabled={!ready} aria-label="Export as JSON">
        JSON
      </Button>
    </div>
  )
}
