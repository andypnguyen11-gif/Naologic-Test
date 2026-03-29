import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SignupPage } from './signup-page';
import { AuthService } from '../auth.service';

@Component({ template: '' })
class DummyRouteComponent {}

describe('SignupPage', () => {
  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['signup']);
  let router: Router;

  beforeEach(async () => {
    authService.signup.calls.reset();

    await TestBed.configureTestingModule({
      imports: [SignupPage],
      providers: [
        provideRouter([{ path: '', component: DummyRouteComponent }]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  it('should block submit when passwords do not match', () => {
    const fixture = TestBed.createComponent(SignupPage);
    const component = fixture.componentInstance as any;
    component.form.setValue({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'StrongPass123A',
      confirmPassword: 'Mismatch123A'
    });

    component.onSubmit();

    expect(authService.signup).not.toHaveBeenCalled();
    expect(component.form.errors?.['passwordMismatch']).toBeTrue();
  });

  it('should submit valid signups and navigate to work orders', () => {
    authService.signup.and.returnValue(of({
      token: 'token',
      user: {
        userId: '1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'Admin'
      }
    }));
    const fixture = TestBed.createComponent(SignupPage);
    const component = fixture.componentInstance as any;
    component.form.setValue({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'StrongPass123A',
      confirmPassword: 'StrongPass123A'
    });

    component.onSubmit();

    expect(authService.signup).toHaveBeenCalledWith({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'StrongPass123A'
    });
    expect(router.navigate).toHaveBeenCalledWith(['/app/work-orders']);
  });
});
