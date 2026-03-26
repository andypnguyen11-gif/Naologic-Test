import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss'
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected isSubmitting = false;
  protected errorMessage: string | null = null;
  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    this.authService.login(this.form.getRawValue())
      .pipe(finalize(() => {
        this.isSubmitting = false;
      }))
      .subscribe({
        next: () => {
          void this.router.navigate(['/app/work-orders']);
        },
        error: () => {
          this.errorMessage = 'Sign-in failed. Check your email, password, and API session.';
        }
      });
  }
}
