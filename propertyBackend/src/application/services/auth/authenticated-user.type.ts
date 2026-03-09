import { UserPermission } from 'src/domain/auth/user-permission.enum';
import { UserRole } from 'src/domain/auth/user-role.enum';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  roles: UserRole[];
  permissions: UserPermission[];
};
