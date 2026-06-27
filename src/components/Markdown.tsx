import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 在對話泡泡內渲染 LLM 回覆的 markdown
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="wc-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
