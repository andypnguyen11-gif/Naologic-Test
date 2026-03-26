import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth/auth.guard';
import { LoginPage } from './auth/login-page/login-page';
import { SignupPage } from './auth/signup-page/signup-page';
import { WorkOrdersPage } from './work-orders/work-orders-page/work-orders-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  { path: 'signup', component: SignupPage, canActivate: [guestGuard] },
  { path: 'app/work-orders', component: WorkOrdersPage, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];
