import { UserPermission, UserRole } from 'src/app/dashboard/auth/authenticated-user.model';

export type AuthUserListItem = {
  id: string;
  email: string | null;
  name: string | null;
  roles: UserRole[];
  permissions: UserPermission[];
  createdAt: string;
  lastLoginAt: string;
};
