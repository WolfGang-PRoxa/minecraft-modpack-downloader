import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Notes de version en Markdown ; les liens s'ouvrent dans le navigateur. */
export function Notes({ markdown, className = '' }: { markdown: string; className?: string }) {
  if (!markdown.trim()) {
    return <p className={`text-sm text-ink-400 italic ${className}`}>Pas de notes pour cette version.</p>
  }
  return (
    <div className={`prose-notes ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                if (href) void window.api.openExternal(href)
              }}
            >
              {children}
            </a>
          ),
          img: () => null
        }}
      >
        {markdown}
      </Markdown>
    </div>
  )
}
