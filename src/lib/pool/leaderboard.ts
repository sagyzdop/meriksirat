export const LEADERBOARD_STATES = ['active', 'full'] as const
export const LEADERBOARD_LIMIT = 100
export const ANONYMOUS_NAME = 'Anonymous flamekeeper'

export interface LeaderboardRow {
  name: string
  image: string | null
  state: string
  pledgedBytes: number
  usedBytes: number
  anonymous: boolean
}

export interface LeaderboardEntry {
  rank: number
  name: string
  image: string | null
  pledgedBytes: number
  usedBytes: number
  anonymous: boolean
}

export function isOnLeaderboard(state: string): boolean {
  return (LEADERBOARD_STATES as readonly string[]).includes(state)
}

export function buildLeaderboard(rows: LeaderboardRow[]): LeaderboardEntry[] {
  const sorted = rows
    .filter((r) => isOnLeaderboard(r.state))
    .sort(
      (a, b) =>
        b.usedBytes - a.usedBytes ||
        b.pledgedBytes - a.pledgedBytes ||
        a.name.localeCompare(b.name)
    )
    .slice(0, LEADERBOARD_LIMIT)

  let rank = 0
  return sorted.map((row, i) => {
    if (i === 0 || row.usedBytes !== sorted[i - 1].usedBytes) rank = i + 1
    return {
      rank,
      name: row.anonymous ? ANONYMOUS_NAME : row.name,
      image: row.anonymous ? null : row.image,
      pledgedBytes: row.pledgedBytes,
      usedBytes: row.usedBytes,
      anonymous: row.anonymous,
    }
  })
}
