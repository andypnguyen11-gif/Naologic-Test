export type UserRole = 'Admin' | 'Planner' | 'Viewer';

export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest extends LoginRequest {
  firstName: string;
  lastName: string;
}
