import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { RequestErrorPolicyService } from 'src/app/core/errors/services/request-error-policy.service';

type AuthUsersResponse = {
  users?: AuthUserListItem[];
};

@Injectable({
  providedIn: 'root'
})
export class AuthUsersService {
  constructor(private readonly requestErrorPolicyService: RequestErrorPolicyService) {}

  async loadUsers(http: HttpClient): Promise<AuthUserListItem[]> {
    try {
      const response = await firstValueFrom(http.get<AuthUsersResponse>('/auth/users'));
      return Array.isArray(response.users) ? response.users : [];
    } catch (error) {
      this.requestErrorPolicyService.notifyFallback(
        'auth.loadUsers',
        this.requestErrorPolicyService.classify(error)
      );
      return [];
    }
  }

  async deleteUser(http: HttpClient, userId: string): Promise<boolean> {
    try {
      await firstValueFrom(http.delete(`/auth/users/${encodeURIComponent(userId)}`));
      return true;
    } catch (error) {
      this.requestErrorPolicyService.notifyFallback(
        'auth.deleteUser',
        this.requestErrorPolicyService.classify(error)
      );
      return false;
    }
  }
}
