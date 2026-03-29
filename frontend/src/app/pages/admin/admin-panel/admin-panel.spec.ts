import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminPanel } from './admin-panel';
import { AdminService } from '../admin.service';

describe('AdminPanel', () => {
  const initialUsers = [
    {
      userId: '1',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'Admin' as const,
      isActive: true,
      createdAt: '2026-03-28T00:00:00Z'
    },
    {
      userId: '2',
      email: 'viewer@example.com',
      firstName: 'View',
      lastName: 'Er',
      role: 'Viewer' as const,
      isActive: true,
      createdAt: '2026-03-29T00:00:00Z'
    }
  ];

  const updatedUsers = [
    initialUsers[0],
    {
      ...initialUsers[1],
      role: 'Planner' as const
    }
  ];

  const adminService = jasmine.createSpyObj<AdminService>('AdminService', ['getUsers', 'updateUserRoles']);

  beforeEach(async () => {
    adminService.getUsers.calls.reset();
    adminService.updateUserRoles.calls.reset();
    adminService.getUsers.and.returnValue(of(initialUsers));

    await TestBed.configureTestingModule({
      imports: [AdminPanel],
      providers: [{ provide: AdminService, useValue: adminService }]
    }).compileComponents();
  });

  it('should load users on init', async () => {
    const fixture = TestBed.createComponent(AdminPanel);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as any;
    expect(component.users.length).toBe(2);
    expect(adminService.getUsers).toHaveBeenCalled();
  });

  it('should enable edit mode and reset pending roles', async () => {
    const fixture = TestBed.createComponent(AdminPanel);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;

    component.enableEditMode();

    expect(component.isEditMode).toBeTrue();
    expect(component.pendingRoles['2']).toBe('Viewer');
  });

  it('should undo pending role changes', async () => {
    const fixture = TestBed.createComponent(AdminPanel);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;

    component.enableEditMode();
    component.pendingRoles['2'] = 'Planner';

    component.undoRoleChanges();

    expect(component.pendingRoles['2']).toBe('Viewer');
  });

  it('should save changed roles and refresh the grid', async () => {
    adminService.getUsers.and.returnValues(of(initialUsers), of(updatedUsers));
    adminService.updateUserRoles.and.returnValue(of(void 0));

    const fixture = TestBed.createComponent(AdminPanel);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;

    component.enableEditMode();
    component.pendingRoles['2'] = 'Planner';

    await component.saveRoleChanges();

    expect(adminService.updateUserRoles).toHaveBeenCalledWith([
      { userId: '2', role: 'Planner' }
    ]);
    expect(component.users[1].role).toBe('Planner');
    expect(component.isEditMode).toBeFalse();
  });

  it('should surface save errors without leaving edit mode', async () => {
    adminService.updateUserRoles.and.returnValue(throwError(() => new Error('fail')));

    const fixture = TestBed.createComponent(AdminPanel);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;

    component.enableEditMode();
    component.pendingRoles['2'] = 'Planner';

    await component.saveRoleChanges();

    expect(component.saveError).toContain('Unable to save');
    expect(component.isEditMode).toBeTrue();
  });
});
