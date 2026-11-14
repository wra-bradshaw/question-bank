import katex from 'katex'
import type { ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { cn } from '../lib/utils.ts'

// Math is rendered with the framework's own `katex` dependency rather than
// rehype-katex, which pins katex@^0.16. KaTeX 0.19 renamed its CSS classes
// (`.base` → `.katex-base`, …), so 0.16 markup styled by 0.19 CSS loses its
// layout (subscripts wrap and overlap). theme.css imports the CSS from the
// same katex package, so markup and stylesheet always agree.
const textOf = (children: ReactNode): string =>
  Array.isArray(children) ? children.map(textOf).join('') : typeof children === 'string' || typeof children === 'number' ? String(children) : ''

const hasClass = (className: unknown, name: string) =>
  (Array.isArray(className) ? className.map(String) : String(className ?? '').split(/\s+/)).includes(name)

function MathFormula({ tex, display }: { tex: string; display: boolean }) {
  const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' })
  return display
    ? <div dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />
}

// Every renderer drops react-markdown's `node` prop so it isn't forwarded to the DOM.
const components: Components = {
  a: ({ node: _node, ...props }) => <a className="font-medium text-green-800 underline decoration-green-300 underline-offset-2 hover:text-green-950" target="_blank" rel="noreferrer" {...props} />,
  blockquote: ({ node: _node, ...props }) => <blockquote className="my-4 border-l-2 border-gray-300 pl-4 text-gray-700" {...props} />,
  code: ({ node: _node, className, children, ...props }) => {
    if (hasClass(className, 'language-math')) {
      return <MathFormula tex={textOf(children)} display={hasClass(className, 'math-display')} />
    }
    // Inline-code styling; fenced blocks reset it via the `pre` renderer below.
    return <code className={cn('rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.9em] text-gray-900 break-words', className)} {...props}>{children}</code>
  },
  h1: ({ node: _node, ...props }) => <h1 className="mb-3 mt-6 text-2xl font-bold tracking-tight text-gray-950 first:mt-0" {...props} />,
  h2: ({ node: _node, ...props }) => <h2 className="mb-3 mt-6 text-xl font-bold tracking-tight text-gray-950 first:mt-0" {...props} />,
  h3: ({ node: _node, ...props }) => <h3 className="mb-2 mt-5 text-lg font-semibold text-gray-950 first:mt-0" {...props} />,
  hr: () => <hr className="my-5 border-gray-200" />,
  img: ({ node: _node, ...props }) => <img className="my-4 h-auto max-w-full rounded-md border border-gray-200" loading="lazy" {...props} />,
  li: ({ node: _node, ...props }) => <li className="my-1 pl-1" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />,
  p: ({ node: _node, ...props }) => <p className="my-3 whitespace-pre-wrap leading-7 first:mt-0 last:mb-0" {...props} />,
  pre: ({ node, children, ...props }) => {
    // remark-math emits display math as <pre><code class="language-math math-display">.
    const first = node?.children.find((child) => child.type === 'element')
    if (first?.type === 'element' && hasClass(first.properties.className, 'math-display')) {
      return <div className="my-4 overflow-x-auto overflow-y-hidden py-1">{children}</div>
    }
    return (
      <pre
        className="my-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-gray-50 [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-sm [&_code]:text-inherit [&_code]:break-normal"
        {...props}
      >
        {children}
      </pre>
    )
  },
  table: ({ node: _node, children, ...props }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm" {...props}>{children}</table></div>,
  tbody: ({ node: _node, ...props }) => <tbody className="divide-y divide-gray-200" {...props} />,
  td: ({ node: _node, ...props }) => <td className="border border-gray-200 px-3 py-2 align-top" {...props} />,
  th: ({ node: _node, ...props }) => <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="my-3 list-disc space-y-1 pl-6" {...props} />,
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

// Inline mode: paragraphs render as spans so short markdown (option text,
// blank labels) can sit inside buttons, select triggers and flex rows.
const inlineComponents: Components = {
  ...components,
  p: ({ node: _node, ...props }) => <span className="whitespace-pre-wrap" {...props} />,
}

// min-w-0 + break-words keep long tokens inside the column; display math
// and wide tables/code scroll horizontally (see the `pre`/`table` renderers).
const blockClassName = 'min-w-0 max-w-full break-words'

export function MarkdownContent({ content, className, inline = false }: { content: string; className?: string; inline?: boolean }) {
  const markdown = (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} components={inline ? inlineComponents : components}>
      {normalizeGfmTables(normalizeMathDelimiters(content))}
    </ReactMarkdown>
  )
  if (inline) return <span className={cn('min-w-0', className)}>{markdown}</span>
  return <div className={cn(blockClassName, 'text-base leading-7 text-gray-800', className)}>{markdown}</div>
}
