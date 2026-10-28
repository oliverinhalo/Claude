/** Narrow a value a test has already established exists. Fails loudly instead of casting. */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected a value');
  return value;
}
