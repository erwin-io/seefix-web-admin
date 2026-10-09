import { Component, Injectable, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { toAppError } from './api';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirm?: string;
  danger?: boolean;
  /** Ask for text (reason, response). Resolves to the text instead of `true`. */
  input?: { label: string; required?: boolean; minLength?: number; maxLength?: number; hint?: string };
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="confirm-message">{{ data.message }}</p>
      @if (data.input; as input) {
        <mat-form-field class="full" appearance="outline">
          <mat-label>{{ input.label }}</mat-label>
          <textarea matInput rows="4" [formControl]="text" cdkFocusInitial></textarea>
          @if (input.hint) {
            <mat-hint>{{ input.hint }}</mat-hint>
          }
          @if (text.invalid && text.touched) {
            <mat-error>{{ input.label }} is required{{ input.minLength ? ' (' + input.minLength + '+ characters)' : '' }}.</mat-error>
          }
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button [class.danger]="data.danger" (click)="submit()">{{ data.confirm ?? 'Confirm' }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ConfirmDialog>);
  readonly text = new FormControl('', {
    nonNullable: true,
    validators: [
      ...(this.data.input?.required ? [Validators.required] : []),
      Validators.minLength(this.data.input?.minLength ?? 0),
      Validators.maxLength(this.data.input?.maxLength ?? 4000),
    ],
  });

  submit(): void {
    if (!this.data.input) return this.ref.close(true);
    this.text.markAsTouched();
    if (this.text.invalid || (this.data.input.required && !this.text.value.trim())) return;
    this.ref.close(this.text.value.trim());
  }
}

@Injectable({ providedIn: 'root' })
export class Ui {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  /** `false` when dismissed; `true` or the entered text when confirmed. */
  confirm(options: ConfirmOptions): Promise<string | boolean> {
    return firstValueFrom(this.dialog.open(ConfirmDialog, { data: options, width: '480px', autoFocus: 'dialog' }).afterClosed()).then(
      (r) => r ?? false,
    );
  }

  toast(message: string): void {
    this.snack.open(message, 'OK', { duration: 4000 });
  }

  error(e: unknown): void {
    this.snack.open(toAppError(e).message, 'Dismiss', { duration: 7000, panelClass: 'snack-error' });
  }
}
