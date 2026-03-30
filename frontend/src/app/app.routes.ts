import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './auth/auth.guard';
import { LoginPage } from './auth/login-page/login-page';
import { SignupPage } from './auth/signup-page/signup-page';
import { AppShell } from './shared/app-shell/app-shell';
import { AdminPanel } from './pages/admin/admin-panel/admin-panel';
import { WorkOrdersPage } from './pages/work-orders/work-orders-page/work-orders-page';
import { PlanningPage } from './pages/planning/planning-page/planning-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  { path: 'signup', component: SignupPage, canActivate: [guestGuard] },
  {
    path: 'app',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'work-orders' },
      { path: 'work-orders', component: WorkOrdersPage },
      { path: 'planning', component: PlanningPage },
      { path: 'admin', component: AdminPanel, canActivate: [adminGuard] }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
