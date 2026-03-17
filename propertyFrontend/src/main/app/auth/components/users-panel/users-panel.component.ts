import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import {
  I18nService,
  SupportedLanguage,
  TranslationKey
} from 'src/app/core/i18n/services/i18n.service';

@Component({
  selector: 'app-users-panel',
  standalone: true,
  templateUrl: './users-panel.component.html',
  styleUrl: './users-panel.component.scss'
})
export class UsersPanelComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) users: AuthUserListItem[] = [];
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input({ required: true }) loading = false;
  @Input() currentUserId: string | null = null;

  @Output() readonly deleteUserRequest = new EventEmitter<string>();

  onDeleteUser(userId: string): void {
    this.deleteUserRequest.emit(userId);
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  getDisplayName(user: AuthUserListItem): string {
    const name = user.name?.trim() ?? '';
    if (name) {
      return name;
    }

    const email = user.email?.trim() ?? '';
    if (email) {
      return email;
    }

    return '-';
  }

  getDisplayRoles(user: AuthUserListItem): string {
    if (!Array.isArray(user.roles) || user.roles.length === 0) {
      return 'STANDARD_USER';
    }
    return user.roles.join(', ');
  }

  getDisplayPermissions(user: AuthUserListItem): string {
    if (!Array.isArray(user.permissions) || user.permissions.length === 0) {
      return '-';
    }
    return user.permissions.join(', ');
  }

  isCurrentUser(user: AuthUserListItem): boolean {
    return !!this.currentUserId && user.id === this.currentUserId;
  }
}
