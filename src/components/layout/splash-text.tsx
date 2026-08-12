import * as React from 'react'
import { useSyncExternalStore } from 'react'
import splashMessages from '@/lib/splash-messages.json'

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g

const STORAGE_KEY = 'meriksirat:splash-index'

function getSplashIndex(): number {
  if (typeof window === 'undefined') {
    return Math.floor(Math.random() * splashMessages.length)
  }
  let stored: number | null = null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const parsed = Number(raw)
      stored = Number.isInteger(parsed) && parsed >= 0 ? parsed : null
    }
  } catch {
    stored = null
  }
  if (stored !== null && stored < splashMessages.length) {
    return stored
  }
  const index = Math.floor(Math.random() * splashMessages.length)
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(index))
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing)
  }
  return index
}

function renderMessage(message: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  for (const match of message.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      parts.push(message.slice(lastIndex, index))
    }
    parts.push(
      <a
        key={key++}
        href={match[2]}
        className="underline underline-offset-2 hover:text-foreground"
      >
        {match[1]}
      </a>
    )
    lastIndex = index + match[0].length
  }
  if (lastIndex < message.length) {
    parts.push(message.slice(lastIndex))
  }
  return parts
}

function useHydrated() {
  return useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false
  )
}

export function SplashText() {
  const hydrated = useHydrated()
  const [index] = React.useState(getSplashIndex)
  if (!hydrated || splashMessages.length === 0) return null
  return <>{renderMessage(splashMessages[index])}</>
}
