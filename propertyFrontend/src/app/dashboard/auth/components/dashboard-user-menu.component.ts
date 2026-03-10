import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-dashboard-user-menu',
  standalone: true,
  templateUrl: './dashboard-user-menu.component.html',
  styleUrl: './dashboard-user-menu.component.css'
})
export class DashboardUserMenuComponent {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18nService = inject(I18nService);

  readonly menuOpen = signal<boolean>(false);
  readonly avatarLoadFailed = signal<boolean>(false);

  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() googleLoginEnabled = true;
  @Input() authenticatedUser: AuthenticatedUser | null = null;
  @Input() avatarUrl: string | null = null;

  @Output() readonly googleLoginRequest = new EventEmitter<void>();
  @Output() readonly logoutRequest = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['avatarUrl']) {
      this.avatarLoadFailed.set(false);
    }
  }

  onToggleMenu(): void {
    this.menuOpen.update((current) => !current);
  }

  onGoogleLoginClick(): void {
    if (!this.googleLoginEnabled) {
      return;
    }

    this.menuOpen.set(false);
    this.googleLoginRequest.emit();
  }

  onLogoutClick(): void {
    this.menuOpen.set(false);
    this.logoutRequest.emit();
  }

  onAvatarError(): void {
    this.avatarLoadFailed.set(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && this.hostElement.nativeElement.contains(target)) {
      return;
    }

    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  get displayName(): string {
    const name = this.authenticatedUser?.name?.trim() ?? '';
    if (name.length > 0) {
      return name;
    }

    const email = this.authenticatedUser?.email?.trim() ?? '';
    if (email.length > 0) {
      return email;
    }

    return this.t('SIGNED_IN_USER');
  }

  get displayRole(): string {
    const user = this.authenticatedUser;
    if (!user || !Array.isArray(user.roles) || user.roles.length === 0) {
      return 'STANDARD_USER';
    }

    return user.roles.join(', ');
  }

  get shouldShowRole(): boolean {
    const user = this.authenticatedUser;
    if (!user || !Array.isArray(user.roles) || user.roles.length === 0) {
      return false;
    }

    return user.roles.some((role) => role !== 'STANDARD_USER');
  }

  get showAvatarImage(): boolean {
    return !!(this.avatarUrl && !this.avatarLoadFailed());
  }
}
