import { clsx, type ClassValue } from 'clsx';
import type { AccessType, MaterialFilters, MaterialType, Role } from '../types';

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function formatFileSize(bytes?: number) {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(value?: string | Date) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDayMonth(value?: string | Date) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getDate()} ${date.toLocaleDateString('en-IN', { month: 'short' })}`;
}

export function humanise(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function nameOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'name' in value) return String((value as { name: unknown }).name);
  return '';
}

/** Each role lands on its own dashboard route; kept here so pages agree with the header. */
export function dashboardPathFor(role: Role) {
  if (role === 'ADMIN') return '/dashboard/admin';
  if (role === 'TEACHER') return '/dashboard/teacher';
  return '/dashboard/student';
}

export const MATERIAL_TYPE_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: 'NOTES', label: 'Notes' },
  { value: 'WORKSHEET', label: 'Worksheet' },
  { value: 'QUESTION_PAPER', label: 'Question Paper' },
  { value: 'SAMPLE_PAPER', label: 'Sample Paper' },
  { value: 'PREVIOUS_YEAR_PAPER', label: 'Previous Year Paper' },
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'REVISION_MATERIAL', label: 'Revision Material' },
  { value: 'PRACTICE_SHEET', label: 'Practice Sheet' },
  { value: 'OTHER', label: 'Other' }
];

export const ACCESS_TYPE_OPTIONS: { value: AccessType; label: string }[] = [
  { value: 'PUBLIC_FREE', label: 'Free for everyone' },
  { value: 'STUDENT_ONLY', label: 'Registered students' },
  { value: 'PAID', label: 'Paid' }
];

export const SORT_OPTIONS: { value: NonNullable<MaterialFilters['sort']>; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' }
];
