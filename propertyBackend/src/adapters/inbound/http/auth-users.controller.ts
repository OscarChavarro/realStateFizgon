import { Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Req } from '@nestjs/common';
import { AuthUserIdentityService } from 'src/application/services/auth/auth-user-identity.service';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';
import { UserListItem } from 'src/adapters/outbound/persistence/mongodb/auth-user.repository';
import { UserPermission } from 'src/domain/auth/user-permission.enum';

type HttpRequestLike = {
  headers?: {
    cookie?: string;
  };
};

@Controller('auth/users')
export class AuthUsersController {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly authUserIdentityService: AuthUserIdentityService
  ) {}

  @Get()
  async listUsers(@Req() request: HttpRequestLike): Promise<{ users: UserListItem[] }> {
    this.assertCanEditUsers(request);
    const users = await this.authUserIdentityService.listUsers();
    return { users };
  }

  @Delete(':userId')
  async deleteUser(
    @Req() request: HttpRequestLike,
    @Param('userId') userId: string
  ): Promise<{ status: string }> {
    this.assertCanEditUsers(request);
    const deleted = await this.authUserIdentityService.deleteUserById(userId);
    if (!deleted) {
      throw new NotFoundException(`User "${userId}" was not found.`);
    }

    return { status: 'deleted' };
  }

  private assertCanEditUsers(request: HttpRequestLike): void {
    const user = this.authSessionService.findUserByCookieHeader(request?.headers?.cookie);
    if (!this.authUserIdentityService.userHasPermission(user, UserPermission.CAN_EDIT_USERS)) {
      throw new ForbiddenException('Missing permission: canEditUsers.');
    }
  }
}
