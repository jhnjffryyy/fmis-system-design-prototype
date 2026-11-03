const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const fmtPrice = (v: number) => v.toFixed(2)

export const fmtPct = (v: number) => {
  const r = v.toFixed(2)
  return r === '0.00' || r === '-0.00' ? '0.00%' : `${v >= 0 ? '+' : ''}${r}%`
}

export const fmtPctAbs = (v: number) => `${v.toFixed(2)}%`

export const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`))

const monthFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  year: 'numeric',
})

export const fmtMonth = (iso: string) => monthFmt.format(new Date(`${iso}T00:00:00Z`))
