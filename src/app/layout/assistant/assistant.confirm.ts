import { ConfirmOptions } from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { UiService } from '@app/shared/services/ui.service';
import { ActionResult } from './assistant.model';

/**
 * Step 1 of every assistant write: ask the API for its preview (`confirm` absent, nothing is written), then show it
 * to the human. Resolves to `true` / the entered text when they confirm, or `null` when they cancel. Only after
 * that does the caller send `confirm: true`.
 */
export async function previewThenConfirm(
  ui: UiService,
  preview: Promise<ActionResult<unknown>>,
  options: Omit<ConfirmOptions, 'message'> & { note?: string },
): Promise<string | true | null> {
  const res = await preview;
  const message = [res.status === 'CONFIRMATION_REQUIRED' ? res.preview : '', options.note ?? '']
    .filter(Boolean)
    .join(' ');
  const answer = await ui.confirm({ ...options, message });
  return answer === false ? null : answer;
}
