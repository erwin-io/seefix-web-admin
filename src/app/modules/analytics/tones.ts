import { statusTone } from '@app/shared/components/status-chip/status-chip.component';

/**
 * Colour tokens for analytics (owner hotfix 5–9). Every coloured value also has its text label, so colour is never
 * the only signal (WCAG 1.4.1). Names describe the hex, not a framework palette. The bright review-queue colours
 * (owner choice) are below the WCAG 1.4.3 text-contrast minimum on white; the tile number is large text (24 px).
 */
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'violet' | 'muted' | 'lime' | 'yellow' | 'orange' | 'redOrange' | 'red';

export const TONE_COLOR: Record<Tone, string> = {
  ok: 'var(--sf-ok)',
  warn: 'var(--sf-warn)',
  danger: 'var(--sf-danger)',
  info: 'var(--sf-accent)',
  violet: 'var(--sf-violet)',
  muted: 'var(--sf-muted)',
  // Review-queue age ramp: yellow → orange → red-orange → red (lime: dark yellow-green, spare).
  lime: '#4d7c0f',
  yellow: '#ffc400',
  orange: '#ff9900',
  redOrange: '#e74900',
  red: '#ff0101',
};

/** Status bars: the app's status tones, except that the owner wants Cancelled red on the charts. */
export function chartTone(status: string): Tone {
  if (status === 'CANCELLED') return 'danger';
  return statusTone(status) as Tone;
}
