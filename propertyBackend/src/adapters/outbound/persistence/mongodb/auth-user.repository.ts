import { Injectable } from '@nestjs/common';
import { Collection, Document, Filter, ObjectId, OptionalId, WithId } from 'mongodb';
import { AuthenticationType } from 'src/domain/auth/authentication-type.enum';
import { UserPermission } from 'src/domain/auth/user-permission.enum';
import { UserRole } from 'src/domain/auth/user-role.enum';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';

export type GoogleIdentityProfile = {
  providerUserId: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

type UserIdentityDocument = {
  type: AuthenticationType;
  providerUserId: string;
  email: string | null;
  linkedAt: Date;
  lastLoginAt: Date;
};

export type UserDocument = {
  email: string | null;
  name: string | null;
  picture: string | null;
  identities: UserIdentityDocument[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
};

type UserPreferencesDocument = {
  userId: ObjectId;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type UserRoleDocument = {
  userId: ObjectId;
  roles: UserRole[];
  permissions: UserPermission[];
  createdAt: Date;
  updatedAt: Date;
};

export type UserListItem = {
  id: string;
  email: string | null;
  name: string | null;
  roles: UserRole[];
  permissions: UserPermission[];
  createdAt: string;
  lastLoginAt: string;
};

@Injectable()
export class AuthUserRepository {
  constructor(private readonly mongoDatabaseService: MongoDatabaseService) {}

  async findUserByIdentity(
    type: AuthenticationType,
    providerUserId: string
  ): Promise<WithId<UserDocument> | null> {
    const collection = await this.getUsersCollection();
    const filter: Filter<UserDocument> = {
      identities: {
        $elemMatch: {
          type,
          providerUserId
        }
      }
    };
    return collection.findOne(filter);
  }

  async findUserByIdentityEmail(type: AuthenticationType, email: string): Promise<WithId<UserDocument> | null> {
    const collection = await this.getUsersCollection();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const filter: Filter<UserDocument> = {
      identities: {
        $elemMatch: {
          type,
          email: normalized
        }
      }
    };
    return collection.findOne(filter);
  }

  async createUserWithIdentity(
    type: AuthenticationType,
    profile: GoogleIdentityProfile
  ): Promise<WithId<UserDocument>> {
    const collection = await this.getUsersCollection();
    const now = new Date();
    const normalizedEmail = this.normalizeEmail(profile.email);

    const newUser: OptionalId<UserDocument> = {
      email: normalizedEmail,
      name: this.normalizeText(profile.name),
      picture: this.normalizeText(profile.picture),
      identities: [
        {
          type,
          providerUserId: profile.providerUserId,
          email: normalizedEmail,
          linkedAt: now,
          lastLoginAt: now
        }
      ],
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };

    const insertResult = await collection.insertOne(newUser as UserDocument);
    const inserted = await collection.findOne({ _id: insertResult.insertedId });
    if (!inserted) {
      throw new Error('Inserted user could not be loaded from MongoDB.');
    }
    return inserted;
  }

  async touchIdentityLogin(
    userId: ObjectId,
    type: AuthenticationType,
    profile: GoogleIdentityProfile
  ): Promise<WithId<UserDocument>> {
    const collection = await this.getUsersCollection();
    const now = new Date();
    const normalizedEmail = this.normalizeEmail(profile.email);

    const updateResult = await collection.updateOne(
      { _id: userId, 'identities.type': type, 'identities.providerUserId': profile.providerUserId },
      {
        $set: {
          email: normalizedEmail,
          name: this.normalizeText(profile.name),
          picture: this.normalizeText(profile.picture),
          updatedAt: now,
          lastLoginAt: now,
          'identities.$.email': normalizedEmail,
          'identities.$.lastLoginAt': now
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      await collection.updateOne(
        { _id: userId },
        {
          $push: {
            identities: {
              type,
              providerUserId: profile.providerUserId,
              email: normalizedEmail,
              linkedAt: now,
              lastLoginAt: now
            }
          },
          $set: {
            email: normalizedEmail,
            name: this.normalizeText(profile.name),
            picture: this.normalizeText(profile.picture),
            updatedAt: now,
            lastLoginAt: now
          }
        }
      );
    }

    const updated = await collection.findOne({ _id: userId });
    if (!updated) {
      throw new Error('Updated user could not be loaded from MongoDB.');
    }
    return updated;
  }

  async ensureUserPreferences(userId: ObjectId): Promise<void> {
    const collection = await this.getUserPreferencesCollection();
    const now = new Date();
    await collection.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          preferences: {},
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    );
  }

  async getUserPreferences(userIdRaw: string): Promise<Record<string, unknown>> {
    const userId = this.parseObjectId(userIdRaw);
    if (!userId) {
      return {};
    }

    const collection = await this.getUserPreferencesCollection();
    const document = await collection.findOne({ userId });
    if (!document || typeof document.preferences !== 'object' || document.preferences === null) {
      return {};
    }

    return document.preferences;
  }

  async mergeUserPreferences(
    userIdRaw: string,
    preferencesPatch: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const userId = this.parseObjectId(userIdRaw);
    if (!userId) {
      return {};
    }

    const collection = await this.getUserPreferencesCollection();
    const current = await collection.findOne({ userId });
    const currentPreferences = (
      current && typeof current.preferences === 'object' && current.preferences !== null
    ) ? current.preferences : {};
    const mergedPreferences = {
      ...currentPreferences,
      ...preferencesPatch
    };
    const now = new Date();

    await collection.updateOne(
      { userId },
      {
        $set: {
          preferences: mergedPreferences,
          updatedAt: now
        },
        $setOnInsert: {
          userId,
          createdAt: now
        }
      },
      { upsert: true }
    );

    return mergedPreferences;
  }

  async findUserRole(userId: ObjectId): Promise<WithId<UserRoleDocument> | null> {
    const collection = await this.getUserRolesCollection();
    return collection.findOne({ userId });
  }

  async createUserRole(userId: ObjectId, roles: UserRole[], permissions: UserPermission[]): Promise<WithId<UserRoleDocument>> {
    const collection = await this.getUserRolesCollection();
    const now = new Date();
    const payload: OptionalId<UserRoleDocument> = {
      userId,
      roles,
      permissions,
      createdAt: now,
      updatedAt: now
    };
    const insertResult = await collection.insertOne(payload as UserRoleDocument);
    const inserted = await collection.findOne({ _id: insertResult.insertedId });
    if (!inserted) {
      throw new Error('Inserted user role could not be loaded from MongoDB.');
    }
    return inserted;
  }

  async updateUserRole(
    userId: ObjectId,
    roles: UserRole[],
    permissions: UserPermission[]
  ): Promise<WithId<UserRoleDocument> | null> {
    const collection = await this.getUserRolesCollection();
    await collection.updateOne(
      { userId },
      {
        $set: {
          roles,
          permissions,
          updatedAt: new Date()
        }
      }
    );
    return collection.findOne({ userId });
  }

  async listUsersWithRoles(): Promise<UserListItem[]> {
    const usersCollection = await this.getUsersCollection();
    const userRoleCollection = await this.getUserRolesCollection();

    const users = await usersCollection.find({}).sort({ createdAt: -1 }).toArray();
    const roles = await userRoleCollection.find({}).toArray();
    const roleByUserId = new Map<string, WithId<UserRoleDocument>>();
    for (const role of roles) {
      roleByUserId.set(role.userId.toHexString(), role);
    }

    return users.map((user) => {
      const role = roleByUserId.get(user._id.toHexString());
      return {
        id: user._id.toHexString(),
        email: user.email ?? null,
        name: user.name ?? null,
        roles: role?.roles ?? [UserRole.STANDARD_USER],
        permissions: role?.permissions ?? [],
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt.toISOString()
      };
    });
  }

  async deleteUserCascade(userIdRaw: string): Promise<boolean> {
    const userId = this.parseObjectId(userIdRaw);
    if (!userId) {
      return false;
    }

    const usersCollection = await this.getUsersCollection();
    const userPreferencesCollection = await this.getUserPreferencesCollection();
    const userRoleCollection = await this.getUserRolesCollection();

    const deleteResult = await usersCollection.deleteOne({ _id: userId });
    if (deleteResult.deletedCount === 0) {
      return false;
    }

    await userPreferencesCollection.deleteMany({ userId });
    await userRoleCollection.deleteMany({ userId });
    return true;
  }

  private parseObjectId(value: string): ObjectId | null {
    try {
      return new ObjectId(value);
    } catch {
      return null;
    }
  }

  private normalizeEmail(email: string | null): string | null {
    const normalized = (email ?? '').trim().toLowerCase();
    return normalized || null;
  }

  private normalizeText(value: string | null): string | null {
    const normalized = (value ?? '').trim();
    return normalized || null;
  }

  private async getUsersCollection(): Promise<Collection<UserDocument>> {
    return this.mongoDatabaseService.getUsersCollection<UserDocument>();
  }

  private async getUserPreferencesCollection(): Promise<Collection<UserPreferencesDocument>> {
    return this.mongoDatabaseService.getUserPreferencesCollection<UserPreferencesDocument>();
  }

  private async getUserRolesCollection(): Promise<Collection<UserRoleDocument>> {
    return this.mongoDatabaseService.getUserRolesCollection<UserRoleDocument>();
  }
}
