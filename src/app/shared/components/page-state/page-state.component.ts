import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** Loading / error / empty placeholder for a page or panel. */
@Component({
  selector: 'app-page-state',
  imports: [MatProgressSpinnerModule, MatButtonModule, MatIconModule],
  templateUrl: './page-state.component.html',
  styleUrl: './page-state.component.scss',
})
export class PageStateComponent {
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** Message shown when there is nothing to list. Falsy = has data. */
  readonly empty = input<string | null>(null);
  readonly icon = input('inbox');
  readonly retry = output();
}
