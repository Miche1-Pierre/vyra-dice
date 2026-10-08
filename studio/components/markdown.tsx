import type { ReactNode } from "react"

/*
 * Just enough Markdown for the agent's notes: headings, paragraphs, lists, tables, quotes,
 * **bold**, *italic* and `code`. Text only — nothing is rendered as HTML.
 */

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const t = m[0]
    if (t.startsWith("**"))
      parts.push(
        <strong key={m.index} className="text-label font-semibold">
          {t.slice(2, -2)}
        </strong>,
      )
    else if (t.startsWith("`"))
      parts.push(
        <code key={m.index} className="font-code rounded bg-white/[0.08] px-1">
          {t.slice(1, -1)}
        </code>,
      )
    else parts.push(<em key={m.index}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n")
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const cls =
        level === 1
          ? "text-title text-label mt-2"
          : level === 2
            ? "text-headline text-label mt-8"
            : "text-callout text-label mt-5 font-semibold"
      blocks.push(
        <p key={i} className={cls}>
          {inline(heading[2])}
        </p>,
      )
      i++
      continue
    }
    if (line.startsWith("|")) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div
          key={i}
          className="mt-4 overflow-x-auto rounded-2xl bg-white/[0.04] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
        >
          <table className="text-footnote w-full text-left">
            <thead>
              <tr>
                {head?.map((c, k) => (
                  <th key={k} className="text-label px-3 py-2 font-semibold">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k} className="border-t border-white/[0.06]">
                  {r.map((c, j) => (
                    <td key={j} className="text-label-2 px-3 py-2 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      const ordered = /^\s*\d+\./.test(line)
      const marker = /^\s*(?:[-*]|\d+\.)\s+/
      while (i < lines.length) {
        if (marker.test(lines[i])) items.push(lines[i].replace(marker, ""))
        // an indented line continues the item above (wrapped text, sub-points)
        else if (/^\s{2,}\S/.test(lines[i]) && items.length)
          items[items.length - 1] += ` ${lines[i].trim()}`
        else break
        i++
      }
      const List = ordered ? "ol" : "ul"
      blocks.push(
        <List
          key={i}
          className={`text-callout text-label-2 mt-3 space-y-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}
        >
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </List>,
      )
      continue
    }
    if (line.startsWith(">")) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith(">"))
        quote.push(lines[i++].replace(/^>\s?/, ""))
      blocks.push(
        <blockquote
          key={i}
          className="text-footnote text-label-3 mt-3 border-l-2 border-white/15 pl-3"
        >
          {inline(quote.join(" "))}
        </blockquote>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]))
      para.push(lines[i++])
    blocks.push(
      <p key={i} className="text-callout text-label-2 mt-3 leading-relaxed">
        {inline(para.join(" "))}
      </p>,
    )
  }
  return <div>{blocks}</div>
}
