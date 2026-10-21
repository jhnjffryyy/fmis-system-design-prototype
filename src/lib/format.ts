const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const fmtPrice = (v: number) => v.toFixed(2)

export const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export const fmtPctPlain = (v: number) => `${v.toFixed(2)} percent`

export const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`))

const monthFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  year: 'numeric',
})

export const fmtMonth = (iso: string) => monthFmt.format(new Date(`${iso}T00:00:00Z`))
