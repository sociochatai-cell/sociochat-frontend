export function maskPhoneNumber(value?: string | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const chars = raw.split('');
  const digitPositions: number[] = [];

  for (let i = 0; i < chars.length; i += 1) {
    if (/\d/.test(chars[i])) {
      digitPositions.push(i);
    }
  }

  if (digitPositions.length === 0) {
    return raw;
  }

  const maskCount = Math.min(4, digitPositions.length);
  for (let i = digitPositions.length - maskCount; i < digitPositions.length; i += 1) {
    chars[digitPositions[i]] = 'X';
  }

  return chars.join('');
}
