import { useEffect, useState } from 'react';

export const formatSum = (value) => `${new Intl.NumberFormat('uz-UZ').format(Math.round(value || 0))} so'm`;

export const formatCompactSum = (value) => {
  const n = Math.round(value || 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mln`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)} ming`;
  return String(n);
};

export const formatMonth = (month) => {
  if (!month) return '';
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('uz-UZ', { month: 'short', year: '2-digit' })
    .format(new Date(year, m - 1, 1));
};

export const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Ijara' },
  { value: 'utilities', label: 'Kommunal' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'equipment', label: 'Jihozlar' },
  { value: 'salary', label: 'Ish haqi' },
  { value: 'tax', label: 'Soliq' },
  { value: 'other', label: 'Boshqa' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Naqd' },
  { value: 'click', label: 'Click' },
  { value: 'payme', label: 'Payme' },
  { value: 'bank', label: 'Bank o\'tkazma' },
  { value: 'other', label: 'Boshqa' },
];

export const categoryLabel = (value) =>
  EXPENSE_CATEGORIES.find(c => c.value === value)?.label || value;

export const methodLabel = (value) =>
  PAYMENT_METHODS.find(m => m.value === value)?.label || value;

// Series colours are mode-specific steps, not an automatic flip: each pair was
// checked for colour-blind separation and contrast against its own surface.
const SERIES = {
  light: { income: '#00BFA6', expense: '#F97316', profit: '#0099FF' },
  dark: { income: '#009985', expense: '#EA580C', profit: '#007ACC' },
};

export function useChartColors() {
  const read = () => (document.documentElement.classList.contains('dark') ? SERIES.dark : SERIES.light);
  const [colors, setColors] = useState(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
