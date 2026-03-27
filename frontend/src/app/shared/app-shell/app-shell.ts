import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss'
})
export class AppShell {
  private readonly authService = inject(AuthService);

  protected get currentUser() {
    return this.authService.currentUser();
  }

  protected get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'Admin';
  }

  protected onLogout(): void {
    this.authService.logout();
  }
}
