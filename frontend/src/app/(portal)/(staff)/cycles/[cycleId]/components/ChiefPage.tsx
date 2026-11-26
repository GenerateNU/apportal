import { notFound } from 'next/navigation'
import { getServerIsChief } from '@/lib/auth/server-user'

export async function requireChief() {
  if (!(await getServerIsChief())) notFound()
}
