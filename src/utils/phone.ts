export const UAE_PHONE_EXAMPLE = '+971501234567';

const toDigits = (value: string) => String(value || '').replace(/\D+/g, '');

export const normalizeUaeMobile = (raw: string): string => {
  const value = String(raw || '').trim();
  if (!value) return '';

  const digits = toDigits(value);

  // 009715XXXXXXXX -> +9715XXXXXXXX
  if (digits.startsWith('00971') && digits.length === 14) {
    return `+${digits.slice(2)}`;
  }

  // 9715XXXXXXXX -> +9715XXXXXXXX
  if (digits.startsWith('9715') && digits.length === 12) {
    return `+${digits}`;
  }

  // 05XXXXXXXX -> +9715XXXXXXXX
  if (digits.startsWith('05') && digits.length === 10) {
    return `+971${digits.slice(1)}`;
  }

  // 5XXXXXXXX -> +9715XXXXXXXX
  if (digits.startsWith('5') && digits.length === 9) {
    return `+971${digits}`;
  }

  // Already normalized and valid length.
  if (value.startsWith('+971') && digits.startsWith('9715') && digits.length === 12) {
    return `+${digits}`;
  }

  return value;
};

export const isValidUaeMobile = (raw: string): boolean => {
  const normalized = normalizeUaeMobile(raw);
  return /^\+9715\d{8}$/.test(normalized);
};
