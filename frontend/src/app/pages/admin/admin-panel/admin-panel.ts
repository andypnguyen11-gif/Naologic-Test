import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminUser } from '../admin.models';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss'
})
export class AdminPanel implements OnInit {
  private readonly adminService = inject(AdminService);

  protected users: AdminUser[] = [];
  protected isLoading = true;
  protected loadError: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.users = await firstValueFrom(this.adminService.getUsers());
    } catch {
      this.loadError = 'Unable to load users. This panel is available to admins only.';
    } finally {
      this.isLoading = false;
    }
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
