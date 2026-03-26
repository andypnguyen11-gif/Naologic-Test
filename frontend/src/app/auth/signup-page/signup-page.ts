import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.scss'
})
export class SignupPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected isSubmitting = false;
  protected errorMessage: string | null = null;
  protected readonly form = this.formBuilder.nonNullable.group(
    {
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: [this.matchPasswordsValidator.bind(this)] }
  );

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { confirmPassword: _confirmPassword, ...payload } = this.form.getRawValue();
    this.isSubmitting = true;
    this.errorMessage = null;
    this.authService.signup(payload)
      .pipe(finalize(() => {
        this.isSubmitting = false;
      }))
      .subscribe({
        next: () => {
          void this.router.navigate(['/app/work-orders']);
        },
        error: () => {
          this.errorMessage = 'Sign-up failed. The email may already exist or the API may be unavailable.';
        }
      });
  }

  private matchPasswordsValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword
      ? { passwordMismatch: true }
      : null;
  }
}
