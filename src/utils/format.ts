import dayjs from 'dayjs';

export function formatDate(d?: string) {
  if (!d) return '';
  return dayjs(d).format('MMM D, YYYY');
}

export function money(amount?: number, currency?: string) {
  if (amount == null) return '';
  const cur = currency || 'LKR';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(2)}`;
  }
}
