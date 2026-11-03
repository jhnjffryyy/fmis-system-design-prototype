export const DRIVERS = [
  'Consolidated net loss after tax of Php 35.91 billion in FY2025, after Php 41.01 billion in FY2024',
  'Total liabilities of Php 306.21 billion against total assets of Php 206.21 billion',
  'Negative equity of Php 100.01 billion at the end of FY2025',
  'Interest expense of Php 18.58 billion in 2024',
  'Foreign exchange loss of Php 8.29 billion in 2024 and Php 7.32 billion in Q3 2025',
]

export const OUTSIDE_FACTORS =
  'Outside factors, notes only: fuel prices and the peso to dollar rate. They help explain the price and are not part of the forecast calculation.'

export const DISCLAIMER =
  'The forecast is only a guide and is not professional financial advice.'

const d = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00Z`))

/** Notes and limitations for the Report; dates come from the loaded file. */
export const limitations = (firstIso: string, lastIso: string): string[] => [
  'Public data from Investing.com.',
  `Daily prices from ${d(firstIso)} to ${d(lastIso)} of the loaded file only.`,
  'Forecast covers 30 days only.',
  'Stock prices are very volatile, so the forecast is only a guide and cannot promise what will happen.',
  'The recommendation follows fixed rules and is not professional financial advice.',
  'The drivers are not calculated inside the forecast.',
  'The system cannot confirm that prices match the source unless they are compared with it.',
]
