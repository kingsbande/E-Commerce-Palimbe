export function formatMWK(value: number | string): string {
  const n = Number(value);
  return `MK ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
