import { UserRole } from '../../auth/auth.models';

export interface AdminUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}
