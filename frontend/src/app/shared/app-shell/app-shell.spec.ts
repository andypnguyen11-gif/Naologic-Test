import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShell } from './app-shell';
import { AuthService } from '../../auth/auth.service';

@Component({ template: '' })
class DummyRouteComponent {}

describe('AppShell', () => {
  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['currentUser', 'logout']);

  beforeEach(async () => {
    authService.currentUser.calls.reset();
    authService.logout.calls.reset();

    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter([{ path: '', component: DummyRouteComponent }]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  it('should hide the admin link for non-admin users', () => {
    authService.currentUser.and.returnValue({
      userId: '1',
      email: 'viewer@example.com',
      firstName: 'Viewer',
      lastName: 'User',
      role: 'Viewer'
    });

    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Work Orders');
    expect(compiled.textContent).not.toContain('Admin');
  });

  it('should show the admin link for admins', () => {
    authService.currentUser.and.returnValue({
      userId: '1',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'Admin'
    });

    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Admin');
  });

  it('should call logout from the shell action', () => {
    authService.currentUser.and.returnValue({
      userId: '1',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'Admin'
    });

    const fixture = TestBed.createComponent(AppShell);
    const component = fixture.componentInstance as any;

    component.onLogout();

    expect(authService.logout).toHaveBeenCalled();
  });
});
