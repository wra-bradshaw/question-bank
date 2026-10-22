import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { cn } from '../lib/utils.ts'

const components: Components = {
  a: ({ ...props }) => <a className="font-medium text-green-800 underline decoration-green-300 underline-offset-2 hover:text-green-950" target="_blank" rel="noreferrer" {...props} />,
  blockquote: ({ ...props }) => <blockquote className="my-4 border-l-2 border-gray-300 pl-4 text-gray-700" {...props} />,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-') ?? false
    return <code className={cn(isBlock ? 'font-mono text-sm' : 'rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.9em] text-gray-900', className)} {...props}>{children}</code>
  },
  h1: ({ ...props }) => <h1 className="mb-3 mt-6 text-2xl font-bold tracking-tight text-gray-950 first:mt-0" {...props} />,
  h2: ({ ...props }) => <h2 className="mb-3 mt-6 text-xl font-bold tracking-tight text-gray-950 first:mt-0" {...props} />,
  h3: ({ ...props }) => <h3 className="mb-2 mt-5 text-lg font-semibold text-gray-950 first:mt-0" {...props} />,
  hr: () => <hr className="my-5 border-gray-200" />,
  img: ({ ...props }) => <img className="my-4 h-auto max-w-full rounded-md border border-gray-200" loading="lazy" {...props} />,
  li: ({ ...props }) => <li className="my-1 pl-1" {...props} />,
  ol: ({ ...props }) => <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />,
  p: ({ ...props }) => <p className="my-3 whitespace-pre-wrap leading-7 first:mt-0 last:mb-0" {...props} />,
  pre: ({ children, ...props }) => <pre className="my-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-gray-50" {...props}>{children}</pre>,
  table: ({ children, ...props }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm" {...props}>{children}</table></div>,
  tbody: ({ ...props }) => <tbody className="divide-y divide-gray-200" {...props} />,
  td: ({ ...props }) => <td className="border border-gray-200 px-3 py-2 align-top" {...props} />,
  th: ({ ...props }) => <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold" {...props} />,
  ul: ({ ...props }) => <ul className="my-3 list-disc space-y-1 pl-6" {...props} />,
}

const markdownCode = /```[\s\S]*?```|~~~[\s\S]*?~~~|(`+)(?!`)[\s\S]*?\1(?!`)/g

const mapOutsideCode = (content: string, transform: (text: string) => string) => {
  let result = ''
  let lastIndex = 0
  for (const match of content.matchAll(markdownCode)) {
    const index = match.index ?? 0
    result += transform(content.slice(lastIndex, index)) + match[0]
    lastIndex = index + match[0].length
  }
  return result + transform(content.slice(lastIndex))
}

// remark-math uses $...$ inline and $$...$$ on separate lines for display math.
// Convert legacy LaTeX delimiters and same-line display expressions to those forms.
const normalizeMathDelimiters = (content: string) => mapOutsideCode(content, (text) => text
  .replace(/\\\[([\s\S]+?)\\\]/g, (_match, formula: string) => `\n$$\n${formula.trim()}\n$$\n`)
  .replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula: string) => `\n$$\n${formula.trim()}\n$$\n`)
  .replace(/\\\(([\s\S]+?)\\\)/g, (_match, formula: string) => `$${formula}$`))

const isPipeRow = (line: string) => line.trimStart().startsWith('|')

const isDelimiterRow = (line: string) => {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.includes('---')
}

const normalizeGfmTables = (content: string) => {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return parts.map((part, index) => {
    if (index % 2 === 1) return part
    const lines = part.split('\n')
    const result: string[] = []
    let tableHasDelimiter = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '') {
        const prev = [...result].reverse().find((item) => item.trim() !== '') ?? ''
        let next = ''
        let afterNext = ''
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() !== '') {
            next = lines[j]
            for (let k = j + 1; k < lines.length; k++) {
              if (lines[k].trim() !== '') {
                afterNext = lines[k]
                break
              }
            }
            break
          }
        }
        if (isPipeRow(prev) && isPipeRow(next)) {
          const startsNewTable = tableHasDelimiter && !isDelimiterRow(prev) && !isDelimiterRow(next) && isDelimiterRow(afterNext)
          if (!startsNewTable) continue
          if (result.length > 0 && result[result.length - 1].trim() === '') continue
        }
        result.push(line)
        continue
      }
      if (isPipeRow(line)) {
        if (isDelimiterRow(line)) tableHasDelimiter = true
      } else {
        tableHasDelimiter = false
      }
      result.push(line)
    }
    return result.join('\n')
  }).join('')
}

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('min-w-0 text-base leading-7 text-gray-800', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {normalizeGfmTables(normalizeMathDelimiters(content))}
      </ReactMarkdown>
    </div>
  )
}
