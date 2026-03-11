import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthUserListItem } from 'src/app/dashboard/auth/auth-user-list-item.model';

type AuthUsersResponse = {
  users?: AuthUserListItem[];
};

@Injectable({
  providedIn: 'root'
})
export class AuthUsersService {
  async loadUsers(http: HttpClient): Promise<AuthUserListItem[]> {
    try {
      const response = await firstValueFrom(
        http.get<AuthUsersResponse>('/auth/users')
      );
      return Array.isArray(response.users) ? response.users : [];
    } catch {
      return [];
    }
  }

  async deleteUser(http: HttpClient, userId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        http.delete(`/auth/users/${encodeURIComponent(userId)}`)
      );
      return true;
    } catch {
      return false;
    }
  }
}
