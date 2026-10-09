import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './access-denied.page.html',
  styleUrl: './access-denied.page.scss',
})
export class AccessDeniedPage {}
