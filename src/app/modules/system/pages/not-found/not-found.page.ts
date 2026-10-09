import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './not-found.page.html',
  styleUrl: './not-found.page.scss',
})
export class NotFoundPage {}
