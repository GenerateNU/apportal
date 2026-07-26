interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({
  children,
  className = '',
}: PageContainerProps) {
  return (
    <div className={`flex flex-col gap-6 p-4 sm:p-8 ${className}`}>
      {children}
    </div>
  )
}
