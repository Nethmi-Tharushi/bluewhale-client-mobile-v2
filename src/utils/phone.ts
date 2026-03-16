export const UAE_PHONE_EXAMPLE = '+971 50 123 4567';

const toDigits = (value: string) => String(value || '').replace(/\D+/g, '');

export const formatUaeMobileInput = (raw: string): string => {
  const value = String(raw || '').trim();
  if (!value) return '';

  const digits = toDigits(value);
  let local = digits;

  if (digits.startsWith('00971')) local = digits.slice(5);
  else if (digits.startsWith('971')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);

  local = local.slice(0, 9);

  const first = local.slice(0, 2);
  const second = local.slice(2, 5);
  const third = local.slice(5, 9);

  return ['+971', first, second, third].filter(Boolean).join(' ');
};

export const normalizeUaeMobile = (raw: string): string => {
  const value = String(raw || '').trim();
  if (!value) return '';

  const digits = toDigits(value);

  // 00971XXXXXXXXX -> +971XXXXXXXXX
  if (digits.startsWith('00971') && digits.length === 14 && /^[2-9]\d{8}$/.test(digits.slice(5))) {
    return `+${digits.slice(2)}`;
  }

  // 971XXXXXXXXX -> +971XXXXXXXXX
  if (digits.startsWith('971') && digits.length === 12 && /^[2-9]\d{8}$/.test(digits.slice(3))) {
    return `+${digits}`;
  }

  // 0XXXXXXXXX -> +971XXXXXXXXX
  if (digits.startsWith('0') && digits.length === 10 && /^[2-9]\d{8}$/.test(digits.slice(1))) {
    return `+971${digits.slice(1)}`;
  }

  // XXXXXXXXX -> +971XXXXXXXXX
  if (/^[2-9]\d{8}$/.test(digits)) {
    return `+971${digits}`;
  }

  // Already normalized and valid length.
  if (value.startsWith('+971') && digits.startsWith('971') && digits.length === 12 && /^[2-9]\d{8}$/.test(digits.slice(3))) {
    return `+${digits}`;
  }

  return value;
};

export const isValidUaeMobile = (raw: string): boolean => {
  const normalized = normalizeUaeMobile(raw);
  return /^\+971[2-9]\d{8}$/.test(normalized);
};
