import { useMemo } from 'react'
import type { Opportunity } from '../api/opportunities'
import { ProgramMarkdownImage } from './ProgramMarkdownImage'
import { RichMarkdown } from './RichMarkdown'
export function OpportunityDescription({
  program,
}: {
  program: Pick<Opportunity, 'program_id' | 'status' | 'summary' | 'content_markdown'>
}) {
  const { program_id, status, summary, content_markdown } = program
  const body = content_markdown.trim()
  const imageComponent = useMemo(
    () => (props: { src?: string; alt?: string }) => (
      <ProgramMarkdownImage
        {...props}
        programId={program_id}
        authenticated={status !== 'published'}
      />
    ),
    [program_id, status],
  )
  return (
    <div className="opportunity-description">
      {summary.trim() !== body.split(/\r?\n\s*\r?\n/, 1)[0] && (
        <p className="opportunity-lead">{summary}</p>
      )}
      {body && <RichMarkdown text={body} imageComponent={imageComponent} />}
    </div>
  )
}
