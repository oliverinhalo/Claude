const whole = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});
const pence = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export const gbp = (n: number): string => whole.format(Math.round(n));
export const gbpExact = (n: number): string => pence.format(Math.round(n * 100) / 100);

/** Plain editable text for a number: no symbol, no grouping. */
export const plainNumber = (n: number): string => String(Math.round(n * 100) / 100);
