export function toMalawiE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let national: string;
  if (digits.startsWith("265")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  // Malawi mobile numbers: 9 digits after the leading 0, starting with 8 or 9
  if (!/^[89]\d{8}$/.test(national)) return null;
  return `+265${national}`;
}
