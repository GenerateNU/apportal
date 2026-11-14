import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({
  className,
  type,
  onWheel,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground focus-visible:border-ink focus-visible:ring-gen-blue/20 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-10 w-full min-w-0 rounded-none border border-gray-300 bg-white px-3 py-2 text-base transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-base',
        className
      )}
      onWheel={(e) => {
        // A focused number input steals the scroll wheel to bump its value
        // instead of scrolling the page — blur it first so scrolling past it
        // (e.g. down a long form) never silently changes what you typed.
        if (type === 'number') e.currentTarget.blur()
        onWheel?.(e)
      }}
      {...props}
    />
  )
}

export { Input }
