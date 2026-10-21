import { fmtPrice } from './format'

export type Decision = 'SELL' | 'WAIT AND WATCH' | 'HOLD'

export interface Condition {
  yes: boolean
  text: string
}

export interface Recommendation {
  decision: Decision
  conditions: Condition[]
}

const r2 = (v: number) => Math.round(v * 100) / 100

/**
 * The three rules:
 * 1. Sell: 30d avg below 90d avg AND forecast lower than latest price.
 * 2. Wait and watch: only one of the two conditions is true.
 * 3. Hold: 30d avg above 90d avg AND forecast higher than latest price.
 * Equal values count as "not true" in either direction.
 */
export function recommend(input: {
  avg30: number
  avg90: number
  forecast30: number
  latest: number
}): Recommendation {
  const avg30 = r2(input.avg30)
  const avg90 = r2(input.avg90)
  const fc = r2(input.forecast30)
  const latest = r2(input.latest)

  const below = avg30 < avg90
  const above = avg30 > avg90
  const fcLower = fc < latest
  const fcHigher = fc > latest

  let decision: Decision
  if (below && fcLower) decision = 'SELL'
  else if (above && fcHigher) decision = 'HOLD'
  else decision = 'WAIT AND WATCH'

  return {
    decision,
    conditions: [
      {
        yes: below,
        text: `30 day average ${fmtPrice(input.avg30)} is below the 90 day average ${fmtPrice(input.avg90)}`,
      },
      {
        yes: fcLower,
        text: `The 30 day forecast ${fmtPrice(input.forecast30)} is lower than the latest price ${fmtPrice(input.latest)}`,
      },
    ],
  }
}
