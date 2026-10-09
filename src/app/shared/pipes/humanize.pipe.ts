import { Pipe, PipeTransform } from '@angular/core';

/** PENDING_REVIEW -> Pending review */
export function humanize(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

@Pipe({ name: 'humanize' })
export class HumanizePipe implements PipeTransform {
  transform = humanize;
}
