export interface ParsedCsv {
  headers: string[]
  records: string[][]
}

/** Parse a CSV with quoted fields. Tolerates CRLF, a BOM, and "" escapes. */
export function parseCsv(text: string): ParsedCsv {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const records: string[][] = []
  let rec: string[] = []
  let field = ''
  let inQ = false
  const pushField = () => {
    rec.push(field)
    field = ''
  }
  const pushRec = () => {
    pushField()
    records.push(rec)
    rec = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') pushField()
    else if (c === '\n') pushRec()
    else if (c !== '\r') field += c
  }
  if (field !== '' || rec.length > 0) pushRec()
  const headers = records.shift() ?? []
  return { headers, records: records.filter((r) => r.length > 1 || r[0] !== '') }
}
