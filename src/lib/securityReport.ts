import { formatUnits } from 'viem'

import type { Approval } from '@/lib/approvals'
import type { Holding } from '@/lib/holdings'
import type { HealthItem, PoisonAttempt } from '@/lib/poisoning'

export type ReportInput = {
  address: string
  chainId: number
  chainName: string
  explorer?: string
  health: { score: number; grade: string; items: HealthItem[] }
  approvals: Approval[]
  attempts: PoisonAttempt[]
  spamTokens: Holding[]
  /** Some checks failed to load. */
  partial: boolean
  /** Approvals came from the holdings fallback, not full log history. */
  approvalsFromHoldings: boolean
}

function allowanceText(a: Approval) {
  if (a.kind === 'nft') return 'All items'
  if (a.unlimited) return 'Unlimited'
  return formatUnits(a.allowance ?? 0n, a.decimals ?? 18)
}

/** Plain, JSON-safe snapshot (no bigint, no Date objects). */
export function buildReport(input: ReportInput, generatedAt = new Date()) {
  return {
    tool: 'Wallet Bodyguard',
    kind: 'security-report',
    version: 1,
    generatedAt: generatedAt.toISOString(),
    wallet: input.address,
    network: { id: input.chainId, name: input.chainName },
    health: {
      score: input.health.score,
      grade: input.health.grade,
      checks: input.health.items.map((i) => ({ ok: i.ok, text: i.text })),
      incomplete: input.partial,
    },
    approvals: input.approvals.map((a) => ({
      type: a.kind === 'nft' ? 'NFT collection (setApprovalForAll)' : 'ERC-20 allowance',
      token: a.token,
      tokenLabel: a.tokenLabel,
      spender: a.spender,
      spenderLabel: a.spenderLabel ?? null,
      amount: allowanceText(a),
      since: a.lastSeen ? a.lastSeen.toISOString() : null,
      risks: a.risks.map((r) => ({ level: r.level, text: r.text })),
    })),
    approvalsSource: input.approvalsFromHoldings ? 'held tokens only (history search unavailable)' : 'full log history',
    poisoningAttempts: input.attempts.map((p) => ({
      scammerAddress: p.attacker,
      imitates: p.imitates,
      imitatesYourWallet: p.imitates.toLowerCase() === input.address.toLowerCase(),
      kind: p.zeroValue ? `fake zero-value ${p.symbol} transfer` : `${p.symbol} dust transfer`,
      date: p.time ? p.time.toISOString() : null,
      tx: p.hash || null,
    })),
    scamTokens: input.spamTokens.map((t) => ({
      name: t.name,
      symbol: t.symbol,
      contract: t.address,
      reason: t.spam ?? null,
    })),
  }
}

export type SecurityReport = ReturnType<typeof buildReport>

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

/**
 * A standalone, printable HTML page. Every value is escaped (token names come from
 * scammers), and the page's CSP forbids scripts and remote loads as a second layer.
 */
export function reportHtml(r: SecurityReport, explorer?: string) {
  const link = (address: string) =>
    explorer ? `<a href="${esc(`${explorer}/address/${address}`)}">${esc(address)}</a>` : `<code>${esc(address)}</code>`
  const txLink = (hash: string | null) =>
    hash && explorer ? `<a class="tx" href="${esc(`${explorer}/tx/${hash}`)}">view</a>` : ''
  const date = (iso: string | null) => (iso ? esc(new Date(iso).toLocaleDateString()) : '—')
  const gradeColor = { A: '#0a7d4f', B: '#4d7c0f', C: '#b45309', D: '#c2410c', F: '#b91c1c' }[r.health.grade] ?? '#333'

  const approvals = r.approvals.length
    ? `<table><thead><tr><th>Token</th><th>Allowed</th><th>Spender</th><th>Since</th><th>Risks</th></tr></thead><tbody>${r.approvals
        .map(
          (a) =>
            `<tr><td><b>${esc(a.tokenLabel)}</b><br><small>${esc(a.type)}</small><br>${link(a.token)}</td><td>${esc(a.amount)}</td><td>${a.spenderLabel ? `<b>${esc(a.spenderLabel)}</b><br>` : ''}${link(a.spender)}</td><td>${date(a.since)}</td><td>${
              a.risks.map((k) => `<div class="risk ${esc(k.level)}">${esc(k.text)}</div>`).join('') || '—'
            }</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="ok">No active approvals — nothing can spend your tokens without asking.</p>'

  const attempts = r.poisoningAttempts.length
    ? `<table><thead><tr><th>Scammer address</th><th>Imitates</th><th>What</th><th>Date</th><th></th></tr></thead><tbody>${r.poisoningAttempts
        .map(
          (p) =>
            `<tr><td>${link(p.scammerAddress)}</td><td>${link(p.imitates)}${p.imitatesYourWallet ? '<br><small>your own wallet</small>' : ''}</td><td>${esc(p.kind)}</td><td>${date(p.date)}</td><td>${txLink(p.tx)}</td></tr>`,
        )
        .join(
          '',
        )}</tbody></table><p><small>Never copy an address from your transaction history. Use a trusted source or your saved contacts.</small></p>`
    : '<p class="ok">No address-poisoning attempts found.</p>'

  const spam = r.scamTokens.length
    ? `<table><thead><tr><th>Token</th><th>Contract</th><th>Why it’s flagged</th></tr></thead><tbody>${r.scamTokens
        .map(
          (t) =>
            `<tr><td>${esc(t.name)} (${esc(t.symbol)})</td><td>${link(t.contract)}</td><td>${esc(t.reason ?? '')}</td></tr>`,
        )
        .join('')}</tbody></table><p><small>Don’t interact with these or visit sites they mention.</small></p>`
    : '<p class="ok">No scam tokens.</p>'

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Security report · ${esc(r.wallet.slice(0, 6))}…${esc(r.wallet.slice(-4))} · ${esc(r.network.name)}</title>
<style>
body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c24;max-width:960px;margin:0 auto;padding:24px 16px;background:#fff}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid #e5e5ea;padding-bottom:4px}
code,a{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}a{color:#5b21b6}
.meta{color:#666;font-size:13px}.score{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.badge{width:92px;height:92px;border-radius:50%;border:8px solid ${gradeColor};display:flex;flex-direction:column;align-items:center;justify-content:center;color:${gradeColor}}
.badge b{font-size:28px;line-height:1}.checks{list-style:none;padding:0;margin:0}.checks li{margin:3px 0}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #eee;padding:6px 8px 6px 0}
th{font-size:12px;color:#666;font-weight:600}.risk{font-size:12px}.risk.danger{color:#b91c1c;font-weight:600}.risk.warning{color:#b45309}
.ok{color:#0a7d4f}.note{background:#fff7ed;border:1px solid #fed7aa;padding:8px 12px;border-radius:8px;font-size:13px}
.tx{white-space:nowrap}footer{margin-top:32px;color:#888;font-size:12px}@media print{body{padding:0}a{color:inherit}}
</style></head><body>
<h1>Wallet security report</h1>
<p class="meta">Wallet <code>${esc(r.wallet)}</code><br>Network: ${esc(r.network.name)} (chain ${esc(r.network.id)}) · Generated ${esc(new Date(r.generatedAt).toLocaleString())}</p>
<h2>Health score</h2>
<div class="score"><div class="badge"><b>${esc(r.health.score)}</b><span>grade ${esc(r.health.grade)}</span></div>
<ul class="checks">${r.health.checks.map((c) => `<li>${c.ok ? '✅' : '❌'} ${esc(c.text)}</li>`).join('')}</ul></div>
${r.health.incomplete ? '<p class="note">Some checks couldn’t load, so this score may be too kind.</p>' : ''}
<h2>Token approvals (${r.approvals.length})</h2>
${approvals}
${r.approvalsSource !== 'full log history' ? `<p class="note">Approvals were checked against ${esc(r.approvalsSource)}; some older approvals may be missing.</p>` : ''}
<h2>Address-poisoning attempts (${r.poisoningAttempts.length})</h2>
${attempts}
<h2>Scam tokens (${r.scamTokens.length})</h2>
${spam}
<footer>Generated by Wallet Bodyguard in your browser from public blockchain data. Nothing was uploaded. This is a snapshot of one network at the time above, not a guarantee — revoke anything you don’t recognise.</footer>
</body></html>`
}

/** Saves a text file in the browser. */
export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
