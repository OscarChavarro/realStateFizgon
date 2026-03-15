import { UserPermission, UserRole } from 'src/app/auth/model/authenticated-user.model';

export type AuthUserListItem = {
  id: string;
  email: string | null;
  name: string | null;
  roles: UserRole[];
  permissions: UserPermission[];
  createdAt: string;
  lastLoginAt: string;
};
