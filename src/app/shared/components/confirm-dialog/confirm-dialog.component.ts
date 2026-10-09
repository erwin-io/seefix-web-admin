import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

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
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ConfirmDialogComponent>);
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
