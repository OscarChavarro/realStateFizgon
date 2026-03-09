import { Injectable } from '@nestjs/common';
import {
  AuthUserRepository,
  GoogleIdentityProfile,
  UserListItem,
  UserRoleDocument
} from 'src/adapters/outbound/persistence/mongodb/auth-user.repository';
import { AuthenticatedUser } from 'src/application/services/auth/authenticated-user.type';
import { AuthenticationType } from 'src/domain/auth/authentication-type.enum';
import { UserPermission } from 'src/domain/auth/user-permission.enum';
import { UserRole } from 'src/domain/auth/user-role.enum';
import { Configuration } from 'src/infrastructure/config/configuration';

@Injectable()
export class AuthUserIdentityService {
  constructor(
    private readonly authUserRepository: AuthUserRepository,
    private readonly configuration: Configuration
  ) {}

  async registerGoogleIdentityLogin(profile: GoogleIdentityProfile): Promise<AuthenticatedUser> {
    const identityType = AuthenticationType.GOOGLE;
    const normalizedEmail = this.normalizeEmail(profile.email);

    let user = await this.authUserRepository.findUserByIdentity(identityType, profile.providerUserId);
    if (!user && normalizedEmail) {
      user = await this.authUserRepository.findUserByIdentityEmail(identityType, normalizedEmail);
    }

    if (user) {
      user = await this.authUserRepository.touchIdentityLogin(user._id, identityType, profile);
    } else {
      user = await this.authUserRepository.createUserWithIdentity(identityType, profile);
    }

    await this.authUserRepository.ensureUserPreferences(user._id);

    let userRole = await this.authUserRepository.findUserRole(user._id);
    if (!userRole) {
      const roles = this.resolveDefaultRoles(user.email, identityType);
      const permissions = this.resolvePermissions(roles);
      userRole = await this.authUserRepository.createUserRole(user._id, roles, permissions);
    } else {
      const normalizedRoles = this.normalizeRoles(userRole.roles);
      const expectedPermissions = this.resolvePermissions(normalizedRoles);
      if (!this.samePermissions(userRole.permissions, expectedPermissions) || !this.sameRoles(userRole.roles, normalizedRoles)) {
        userRole = await this.authUserRepository.updateUserRole(user._id, normalizedRoles, expectedPermissions);
      }
    }

    if (!userRole) {
      throw new Error('User role could not be resolved for authenticated user.');
    }

    return this.toAuthenticatedUser(user, userRole);
  }

  async listUsers(): Promise<UserListItem[]> {
    return this.authUserRepository.listUsersWithRoles();
  }

  async deleteUserById(userId: string): Promise<boolean> {
    return this.authUserRepository.deleteUserCascade(userId);
  }

  userHasPermission(user: AuthenticatedUser | null, permission: UserPermission): boolean {
    if (!user) {
      return false;
    }

    return user.permissions.includes(permission);
  }

  private resolveDefaultRoles(email: string | null, type: AuthenticationType): UserRole[] {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return [UserRole.STANDARD_USER];
    }

    const assignment = this.configuration.authDefaultRoles.find((item) =>
      item.user.email === normalizedEmail && item.user.type === type
    );
    if (!assignment || assignment.roles.length === 0) {
      return [UserRole.STANDARD_USER];
    }

    return assignment.roles;
  }

  private resolvePermissions(roles: UserRole[]): UserPermission[] {
    const permissions = new Set<UserPermission>();
    if (roles.includes(UserRole.ADMIN)) {
      permissions.add(UserPermission.CAN_EDIT_USERS);
      permissions.add(UserPermission.CAN_MAINTAIN_DATABASE);
    }
    return Array.from(permissions);
  }

  private normalizeRoles(rawRoles: UserRole[] | undefined): UserRole[] {
    const normalized = new Set<UserRole>();
    for (const role of rawRoles ?? []) {
      if (role === UserRole.ADMIN || role === UserRole.STANDARD_USER) {
        normalized.add(role);
      }
    }

    if (normalized.size === 0) {
      normalized.add(UserRole.STANDARD_USER);
    }

    return Array.from(normalized);
  }

  private sameRoles(current: UserRole[] | undefined, expected: UserRole[]): boolean {
    const currentSet = new Set(current ?? []);
    if (currentSet.size !== expected.length) {
      return false;
    }
    return expected.every((item) => currentSet.has(item));
  }

  private samePermissions(current: UserPermission[] | undefined, expected: UserPermission[]): boolean {
    const currentSet = new Set(current ?? []);
    if (currentSet.size !== expected.length) {
      return false;
    }
    return expected.every((item) => currentSet.has(item));
  }

  private toAuthenticatedUser(
    user: {
      _id: { toHexString(): string };
      email: string | null;
      name: string | null;
      picture: string | null;
    },
    userRole: UserRoleDocument
  ): AuthenticatedUser {
    return {
      id: user._id.toHexString(),
      email: user.email,
      name: user.name,
      picture: user.picture,
      roles: userRole.roles,
      permissions: userRole.permissions
    };
  }

  private normalizeEmail(email: string | null): string | null {
    const normalized = (email ?? '').trim().toLowerCase();
    return normalized || null;
  }
}
