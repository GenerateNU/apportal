import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

// Renders admin-authored Markdown (e.g. application intro/closing text)
// without pulling in @tailwindcss/typography — just enough element styling
// to read well inline with the rest of the app's type scale.
export function MarkdownContent({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-blue underline underline-offset-2"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="list-decimal pl-5">{children}</ol>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-300 pl-3 italic">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
              {children}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
