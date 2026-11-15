import { useEffect, useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { axiosInstance } from '../api/http'
export const markdownSchema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, src: ['http', 'https', 'blob', 'data'] },
}
export function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [resolved, setResolved] = useState(src)
  useEffect(() => {
    let active = true,
      temporary: string | undefined
    setResolved(src)
    if (src?.startsWith('/api/'))
      axiosInstance
        .get(src.replace(/^\/api\/v1/, ''), { responseType: 'blob' })
        .then(({ data }) => {
          if (active) {
            temporary = URL.createObjectURL(data)
            setResolved(temporary)
          }
        })
        .catch(() => {
          if (active) setResolved(undefined)
        })
    return () => {
      active = false
      if (temporary) URL.revokeObjectURL(temporary)
    }
  }, [src])
  return resolved ? (
    <img src={resolved} alt={alt || ''} loading="lazy" />
  ) : (
    <span>{alt || 'Изображение недоступно'}</span>
  )
}
export function RichMarkdown({ text }: { text: string }) {
  return (
    <div className="rich-description" data-color-mode="light">
      <MDEditor.Markdown
        source={text}
        rehypePlugins={[[rehypeSanitize, markdownSchema]]}
        components={{ img: (props) => <MarkdownImage src={props.src} alt={props.alt} /> }}
      />
    </div>
  )
}
