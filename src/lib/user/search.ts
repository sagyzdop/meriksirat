import { like, or } from 'drizzle-orm'
import { user } from '@/db/schema'

export function userSearch(term: string) {
  const pattern = `%${term}%`
  return or(
    like(user.name, pattern),
    like(user.email, pattern),
    like(user.firstName, pattern),
    like(user.lastName, pattern)
  )!
}
