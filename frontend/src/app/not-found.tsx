import { ErrorScreen } from '@/components/ErrorScreen'

export default function NotFound() {
  return (
    <ErrorScreen
      fullPage
      code="404"
      title="Page not found"
      message="This page doesn't exist or has moved."
    />
  )
}
