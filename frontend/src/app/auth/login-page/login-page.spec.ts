import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginPage } from './login-page';
import { AuthService } from '../auth.service';

@Component({ template: '' })
class DummyRouteComponent {}

describe('LoginPage', () => {
  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
  let router: Router;

  beforeEach(async () => {
    authService.login.calls.reset();

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([{ path: '', component: DummyRouteComponent }]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  it('should not submit when the form is invalid', () => {
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance as any;

    component.onSubmit();

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('should submit valid credentials and navigate to work orders', () => {
    authService.login.and.returnValue(of({
      token: 'token',
      user: {
        userId: '1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'Admin'
      }
    }));
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance as any;
    component.form.setValue({
      email: 'admin@example.com',
      password: 'StrongPass123A'
    });

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'StrongPass123A'
    });
    expect(router.navigate).toHaveBeenCalledWith(['/app/work-orders']);
  });

  it('should surface an error when login fails', () => {
    authService.login.and.returnValue(throwError(() => new Error('nope')));

    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance as any;
    component.form.setValue({
      email: 'admin@example.com',
      password: 'StrongPass123A'
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage).toContain('Sign-in failed');
  });
});
