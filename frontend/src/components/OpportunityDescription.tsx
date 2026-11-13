import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'

export function OpportunityDescription({
  summary,
  markdown,
}: {
  summary: string
  markdown: string
}) {
  const body = markdown.trim()
  const firstParagraph = body.split(/\r?\n\s*\r?\n/, 1)[0]
  return (
    <div className="opportunity-description" data-color-mode="light">
      {summary.trim() !== firstParagraph && <p className="opportunity-lead">{summary}</p>}
      {body && <MDEditor.Markdown source={body} rehypePlugins={[rehypeSanitize]} />}
    </div>
  )
}
