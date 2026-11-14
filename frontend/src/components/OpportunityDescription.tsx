import { RichMarkdown } from './RichMarkdown'
export function OpportunityDescription({
  summary,
  markdown,
}: {
  summary: string
  markdown: string
}) {
  const body = markdown.trim()
  return (
    <div className="opportunity-description">
      {summary.trim() !== body.split(/\r?\n\s*\r?\n/, 1)[0] && (
        <p className="opportunity-lead">{summary}</p>
      )}
      {body && <RichMarkdown text={body} />}
    </div>
  )
}
