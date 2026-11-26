import { useState } from 'react'
import { ArrowDown, RefreshCw } from 'lucide-react'
import { callWhatAction } from '../lib/what-api'

type RefreshStats = {
  fetched: number
  processed: number
  accepted: number
  rejected: number
  deduplicated: number
  saved: number
  rejectionReasons?: Record<string, number>
  deduplicatedSources?: number
  sourceRejectionReasons?: Record<string, number>
  aiValidationIssues?: Record<string, number>
  message?: string
}

function summarize(stats: RefreshStats): string {
  const counts = `Fetched ${stats.fetched} · processed ${stats.processed} · accepted ${stats.accepted} · rejected ${stats.rejected} · deduplicated ${stats.deduplicated} · saved ${stats.saved}`
  const reasons = Object.entries(stats.rejectionReasons ?? {}).filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason.replaceAll('_', ' ')} (${count})`)
  const sourceReasons = Object.entries(stats.sourceRejectionReasons ?? {}).filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason.replaceAll('_', ' ')} (${count})`)
  const validationIssues = Object.entries(stats.aiValidationIssues ?? {}).filter(([, count]) => count > 0)
    .map(([issue, count]) => `${issue.replaceAll('_', ' ')} (${count})`)
  const sourceNotes = [stats.deduplicatedSources ? `${stats.deduplicatedSources} duplicate source articles` : '', sourceReasons.length ? `source filters: ${sourceReasons.join(', ')}` : ''].filter(Boolean)
  return [
    stats.message,
    counts,
    reasons.length ? `Story skips: ${reasons.join(', ')}.` : '',
    sourceNotes.length ? `Source articles: ${sourceNotes.join('; ')}.` : '',
    validationIssues.length ? `AI validation: ${validationIssues.join(', ')}.` : '',
  ].filter(Boolean).join(' ')
}

export default function NewsRefreshControl({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  async function refresh(batchSize: 5 | 20) {
    if (batchSize === 20 && !window.confirm('This refresh may make up to 5 NewsAPI requests, 20 Exa searches, and 5 OpenAI requests (one per four source-ready stories). Those calls use DeepSpace credits. Continue?')) return
    setBusy(true)
    setMessage('')
    try {
      const result = await callWhatAction<RefreshStats>('refresh-news', { batchSize })
      setFailed(!result.success)
      setMessage(result.success ? summarize(result.data) : result.error)
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? `Refresh failed: ${error.message}` : 'Refresh failed before results were returned.')
    } finally {
      setBusy(false)
    }
  }

  return <span className={`admin-refresh-wrap ${compact ? 'admin-refresh-wrap--compact' : ''}`}>
    <span className="refresh-buttons">
      <button className={compact ? 'refresh-icon-button' : 'pill-button pill-button--dark'} onClick={() => void refresh(5)} disabled={busy} title="Refresh up to five new stories">
        {busy ? <><RefreshCw size={14} className="spin" /> Refreshing…</> : compact ? 'Refresh 5' : <><ArrowDown size={16} /> Refresh up to 5 stories</>}
      </button>
      <button className={compact ? 'refresh-icon-button refresh-icon-button--large' : 'pill-button pill-button--soft'} onClick={() => void refresh(20)} disabled={busy} title="Build a larger metered batch of up to 20 stories" aria-label="Build a larger batch of up to 20 stories">
        {compact ? '+20' : 'Build a larger batch · 20'}
      </button>
    </span>
    {message && <span role={failed ? 'alert' : 'status'} className={`action-note ${failed ? 'action-note--error' : ''}`}>{message}</span>}
  </span>
}
