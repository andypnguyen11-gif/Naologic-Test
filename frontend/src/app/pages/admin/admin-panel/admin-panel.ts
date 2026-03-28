import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserRole } from '../../../auth/auth.models';
import { AdminUser, UpdateUserRoleItemRequest } from '../admin.models';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss'
})
export class AdminPanel implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly roleOptions: UserRole[] = ['Admin', 'Planner', 'Viewer'];
  protected users: AdminUser[] = [];
  protected pendingRoles: Record<string, UserRole> = {};
  protected isLoading = true;
  protected isEditMode = false;
  protected isSaving = false;
  protected loadError: string | null = null;
  protected saveError: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  protected enableEditMode(): void {
    this.isEditMode = true;
    this.saveError = null;
    this.resetPendingRoles();
  }

  protected undoRoleChanges(): void {
    this.saveError = null;
    this.resetPendingRoles();
  }

  protected hasRoleChanged(user: AdminUser): boolean {
    return this.pendingRoles[user.userId] !== user.role;
  }

  protected async saveRoleChanges(): Promise<void> {
    const updates: UpdateUserRoleItemRequest[] = this.users
      .filter((user) => this.pendingRoles[user.userId] !== user.role)
      .map((user) => ({
        userId: user.userId,
        role: this.pendingRoles[user.userId]
      }));

    if (!updates.length) {
      this.isEditMode = false;
      return;
    }

    this.isSaving = true;
    this.saveError = null;

    try {
      await firstValueFrom(this.adminService.updateUserRoles(updates));
      await this.loadUsers();
      this.isEditMode = false;
    } catch {
      this.saveError = 'Unable to save user role changes.';
    } finally {
      this.isSaving = false;
    }
  }

  private async loadUsers(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;

    try {
      this.users = await firstValueFrom(this.adminService.getUsers());
      this.resetPendingRoles();
    } catch {
      this.loadError = 'Unable to load users. This panel is available to admins only.';
    } finally {
      this.isLoading = false;
    }
  }

  private resetPendingRoles(): void {
    this.pendingRoles = this.users.reduce<Record<string, UserRole>>((roles, user) => {
      roles[user.userId] = user.role;
      return roles;
    }, {});
  }
}
