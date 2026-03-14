export type UserRole = 'ADMIN' | 'STANDARD_USER';

export type UserPermission = 'canEditUsers' | 'canMaintainDatabase';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  roles: UserRole[];
  permissions: UserPermission[];
};
