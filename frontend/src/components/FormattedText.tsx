import React from 'react'
// Render a small Markdown subset as React nodes; HTML is always escaped.
export const FormattedText: React.FC<{ text: string }> = ({ text }) => <div>{text.split('\n').map((line, i) => {
  const inline = (value: string) => value.split(/(\*\*.*?\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part, j) => {
    if (part.startsWith('**')) return <strong key={j}>{part.slice(2, -2)}</strong>
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    return link ? <a key={j} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a> : part
  })
  return line.startsWith('## ') ? <h3 key={i}>{inline(line.slice(3))}</h3> : line.startsWith('# ') ? <h2 key={i}>{inline(line.slice(2))}</h2> : <p key={i}>{inline(line) || <br />}</p>
})}</div>
