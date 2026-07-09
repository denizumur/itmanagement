export type UserRole = "admin" | "technician" | "viewer";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  role: UserRole | null;
}