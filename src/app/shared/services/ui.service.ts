import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { toAppError } from '@app/core/http/app-error';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmOptions } from '../components/confirm-dialog/confirm-dialog.component';

/** Confirmation dialogs and toasts. Every mutation goes through `confirm()` first. */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  /** `false` when dismissed; `true` or the entered text when confirmed. */
  confirm(options: ConfirmOptions): Promise<string | boolean> {
    return firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, { data: options, width: '480px', autoFocus: 'dialog' }).afterClosed(),
    ).then((r) => r ?? false);
  }

  toast(message: string): void {
    this.snack.open(message, 'OK', { duration: 4000 });
  }

  error(e: unknown): void {
    this.snack.open(toAppError(e).message, 'Dismiss', { duration: 7000, panelClass: 'snack-error' });
  }
}
