/** Extracts the first decimal price (e.g. "$19.99", "AED 79.00") from a text string, in minor units. */
export function parsePriceToMinorUnits(text: string): number | null {
  const match = text.replace(/,/g, "").match(/(\d+\.\d{2})/);
  if (!match) return null;
  return Math.round(parseFloat(match[1]) * 100);
}
