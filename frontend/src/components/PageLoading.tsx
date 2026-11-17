import { PageContainer } from '@/components/PageContainer'
import { type Crumb, Breadcrumbs } from '@/components/ui/breadcrumbs'

// Holds the crumb row where PageHeader draws it, so nothing jumps when the page arrives.
export function PageLoading({ crumbs = [] }: { crumbs?: Crumb[] }) {
  return (
    <PageContainer>
      {crumbs.length > 1 ? (
        <Breadcrumbs items={crumbs} />
      ) : (
        <div aria-hidden className="invisible">
          <Breadcrumbs items={[{ label: ' ' }]} />
        </div>
      )}
      <div
        role="status"
        aria-label="Loading"
        className="border-text-faint border-t-primary mx-auto mt-16 size-8 animate-spin rounded-full border-4"
      />
    </PageContainer>
  )
}
