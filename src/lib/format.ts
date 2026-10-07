const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Whole euros, French style: `1 000 €` (Intl's narrow no-break spaces are kept). */
export function formatEuro(amount: number): string {
  return euroFormatter.format(amount)
}

/** `4–6 pers.`, or `6 pers.` when the capacity is fixed. */
export function formatCapacity({ min, max }: { min: number; max: number }): string {
  return min === max ? `${max} pers.` : `${min}–${max} pers.`
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})

/** `2026-10-10` → `samedi 10 octobre` (`1er` for the first of the month). */
export function formatDateFr(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : null
  if (!date || date.toISOString().slice(0, 10) !== isoDate) {
    throw new RangeError(`Invalid ISO date: ${isoDate}`)
  }
  return dateFormatter
    .formatToParts(date)
    .map((part) => (part.type === "day" && part.value === "1" ? "1er" : part.value))
    .join("")
}
