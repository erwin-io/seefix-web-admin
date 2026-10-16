import { statusTone } from '@app/shared/components/status-chip/status-chip.component';

/**
 * Colour tokens for analytics (owner hotfix 5–9). Every coloured value also has its text label, so colour is never
 * the only signal (WCAG 1.4.1); each colour is ≥ 4.5:1 on white for text (WCAG 1.4.3).
 */
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'violet' | 'muted' | 'lime' | 'yellow' | 'amber' | 'orange' | 'red';

export const TONE_COLOR: Record<Tone, string> = {
  ok: 'var(--sf-ok)',
  warn: 'var(--sf-warn)',
  danger: 'var(--sf-danger)',
  info: 'var(--sf-accent)',
  violet: 'var(--sf-violet)',
  muted: 'var(--sf-muted)',
  // Review-queue age ramp: yellow-green → yellow → yellow-orange → red-orange → red.
  lime: '#4d7c0f',
  yellow: '#a16207',
  amber: '#b45309',
  orange: '#c2410c',
  red: '#b91c1c',
};

/** Status bars: the app's status tones, except that the owner wants Cancelled red on the charts. */
export function chartTone(status: string): Tone {
  if (status === 'CANCELLED') return 'danger';
  return statusTone(status) as Tone;
}
