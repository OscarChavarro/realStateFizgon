import { HttpClient } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { UsersPanelComponent } from 'src/app/auth/components/users-panel/users-panel.component';
import { MaintenancePanelComponent } from 'src/app/maintenance/components/maintenance-panel/maintenance-panel.component';
import { ListingPropertiesTableComponent } from 'src/app/listing/components/listing-properties-table/listing-properties-table.component';
import { ListingMapTabComponent } from 'src/app/listing/components/listing-map-tab/listing-map-tab.component';
import { ListingTopBarComponent } from 'src/app/listing/components/listing-top-bar/listing-top-bar.component';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import {
  ListingPropertyRow,
  ListingTab,
  SortToggleRequest
} from 'src/app/listing/model/listing.types';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';
import { AuthBootstrapUseCaseService } from 'src/app/auth/services/auth-bootstrap.use-case.service';
import { ListingBootstrapUseCaseService } from 'src/app/listing/services/listing-bootstrap.use-case.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { ListingInteractionUseCaseService } from 'src/app/listing/services/listing-interaction.use-case.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';
import { PropertyDetailPanelComponent } from 'src/app/property/components/property-detail-panel/property-detail-panel.component';
import { ShellInputInteractionUseCaseService } from 'src/app/shell/services/shell-input-interaction.use-case.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';
import { AppShellCommandsUseCaseService } from 'src/app/shell/services/app-shell-commands.use-case.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ListingTopBarComponent,
    ListingPropertiesTableComponent,
    ListingMapTabComponent,
    MaintenancePanelComponent,
    UsersPanelComponent,
    PropertyDetailPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';
  private locationRef: Pick<Location, 'assign'> = window.location;

  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listingAuthFacadeService = inject(AuthFacadeService);
  private readonly workspaceInteractionCoordinatorService = inject(
    WorkspaceInteractionCoordinatorService
  );
  private readonly authBootstrapUseCaseService = inject(AuthBootstrapUseCaseService);
  private readonly listingBootstrapUseCaseService = inject(ListingBootstrapUseCaseService);
  private readonly propertySelectionService = inject(PropertySelectionService);
  private readonly listingQueryOrchestratorService = inject(ListingQueryOrchestratorService);
  private readonly listingInteractionUseCaseService = inject(ListingInteractionUseCaseService);
  private readonly shellInputInteractionUseCaseService = inject(
    ShellInputInteractionUseCaseService
  );
  private readonly appShellStateService = inject(AppShellStateService);
  private readonly appShellCommandsUseCaseService = inject(AppShellCommandsUseCaseService);

  @ViewChild('workspaceContainer') workspaceContainer?: ElementRef<HTMLDivElement>;
  @ViewChild(ListingPropertiesTableComponent)
  listingPropertiesTable?: ListingPropertiesTableComponent;
  @ViewChild(PropertyDetailPanelComponent) propertyDetailPanel?: PropertyDetailPanelComponent;

  readonly count = this.appShellStateService.count;
  readonly loading = this.appShellStateService.loading;
  readonly allProperties = this.appShellStateService.allProperties;
  readonly filters = this.appShellStateService.filters;
  readonly pagination = this.appShellStateService.pagination;
  readonly properties = this.appShellStateService.properties;
  readonly filteredTotalElements = this.appShellStateService.filteredTotalElements;
  readonly visibleCount = this.appShellStateService.visibleCount;
  readonly selectedProperty = this.appShellStateService.selectedProperty;
  readonly lockedSelectedPropertyKey = this.appShellStateService.lockedSelectedPropertyKey;
  readonly selectedLanguage = this.appShellStateService.selectedLanguage;
  readonly activeTab = this.appShellStateService.activeTab;
  readonly googleLoginEnabled = this.appShellStateService.googleLoginEnabled;
  readonly authenticatedUser = this.appShellStateService.authenticatedUser;
  readonly canEditUsers = this.appShellStateService.canEditUsers;
  readonly canMaintainDatabase = this.appShellStateService.canMaintainDatabase;
  readonly authenticatedUserAvatarUrl = this.appShellStateService.authenticatedUserAvatarUrl;
  readonly users = this.appShellStateService.users;
  readonly usersLoading = this.appShellStateService.usersLoading;
  readonly propertyLabels = this.appShellStateService.propertyLabels;
  readonly maintenanceOperations = this.appShellStateService.maintenanceOperations;
  readonly maintenanceRunning = this.appShellStateService.maintenanceRunning;
  readonly maintenanceResultText = this.appShellStateService.maintenanceResultText;
  readonly sortCriteria = this.appShellStateService.sortCriteria;
  readonly leftPanelHidden = this.appShellStateService.leftPanelHidden;
  readonly rightPanelHidden = this.appShellStateService.rightPanelHidden;

  async ngOnInit(): Promise<void> {
    this.filteredTotalElements.set(
      this.listingQueryOrchestratorService.readFilteredTotalElementsFromSession()
    );

    await this.authBootstrapUseCaseService.initialize(
      this.http,
      this.destroyRef,
      window.location.hostname,
      AppComponent.SELECTED_LANGUAGE_KEY
    );

    await this.listingBootstrapUseCaseService.initialize({
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  ngOnDestroy(): void {
    this.listingBootstrapUseCaseService.teardown();
  }

  onTabChange(tabId: ListingTab): void {
    this.appShellCommandsUseCaseService.onTabChange(this.http, tabId);
  }

  onLanguageChange(language: SupportedLanguage): void {
    this.appShellCommandsUseCaseService.onLanguageChange(
      this.http,
      language,
      AppComponent.SELECTED_LANGUAGE_KEY
    );
  }

  onFiltersChange(filters: ListingFiltersState): void {
    void this.handleFiltersChange(filters);
  }

  onSortToggle(request: SortToggleRequest): void {
    void this.toggleSort(request.sortBy);
  }

  onPageChange(page: number): void {
    void this.changePage(page);
  }

  onPageSizeChange(pageSize: number): void {
    void this.changePageSize(pageSize);
  }

  onPropertyRowHover(property: ListingPropertyRow): void {
    this.propertySelectionService.onRowHover(property);
  }

  onPropertyRowClick(property: ListingPropertyRow): void {
    this.propertySelectionService.onRowClick(property);
  }

  onPropertyReviewToggle(property: ListingPropertyRow): void {
    void this.togglePropertyReview(property);
  }

  onPropertyCommentSave(event: { property: ListingPropertyRow; comment: string }): void {
    void this.savePropertyComment(event.property, event.comment);
  }

  onSplitterMouseDown(event: MouseEvent): void {
    this.shellInputInteractionUseCaseService.onSplitterMouseDown(event);
  }

  cycleWorkspaceLayout(): void {
    this.workspaceInteractionCoordinatorService.cycleLayout();
  }

  getWorkspaceColumns(): string {
    return this.workspaceInteractionCoordinatorService.getWorkspaceColumns();
  }

  getWorkspaceCycleIcon(): string {
    return this.workspaceInteractionCoordinatorService.getCycleIcon();
  }

  onMaintenanceOperationRequested(operation: DatabaseMaintenanceOperation): void {
    this.appShellCommandsUseCaseService.onMaintenanceOperationRequested(operation, this.http);
  }

  getStaticMediaBaseUrl(): string {
    return this.appShellStateService.staticMediaBaseUrl();
  }

  getGoogleMapsApiKey(): string | null {
    return this.appShellStateService.googleMapsApiKey();
  }

  getGoogleMapsMapId(): string | null {
    return this.appShellStateService.googleMapsMapId();
  }

  onFullscreenRequested(): void {
    this.workspaceInteractionCoordinatorService.toggleFullscreen();
  }

  onGoogleLoginRequested(): void {
    const loginUrl = this.listingAuthFacadeService.buildGoogleLoginUrl(window.location.href);
    this.navigateTo(loginUrl);
  }

  onLogoutRequested(): void {
    this.appShellCommandsUseCaseService.onLogoutRequested(this.http);
  }

  onDeleteUserRequested(userId: string): void {
    this.appShellCommandsUseCaseService.onDeleteUserRequested(this.http, userId);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    this.shellInputInteractionUseCaseService.onWindowMouseMove(event, this.workspaceContainer);
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.shellInputInteractionUseCaseService.onWindowMouseUp();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    this.shellInputInteractionUseCaseService.onWindowKeyDown({
      event,
      activeTab: this.activeTab(),
      isAuthenticated: this.authenticatedUser() !== null,
      properties: this.properties(),
      selectedProperty: this.selectedProperty(),
      onTogglePropertyReview: (property) => {
        void this.togglePropertyReview(property);
      },
      onTogglePropertyLocationDialog: () => {
        this.propertyDetailPanel?.toggleLocationDialog();
      },
      scroller: this.listingPropertiesTable
    });
  }

  private async refreshListingData(): Promise<void> {
    await this.listingQueryOrchestratorService.refreshListingData(this.http);
  }

  private async handleFiltersChange(filters: ListingFiltersState): Promise<void> {
    await this.listingQueryOrchestratorService.handleFiltersChange(this.http, filters);
  }

  private async loadUserPreferences(): Promise<void> {
    await this.listingQueryOrchestratorService.loadUserPreferences(this.http);
  }

  private async togglePropertyReview(property: ListingPropertyRow): Promise<void> {
    await this.listingInteractionUseCaseService.togglePropertyReview({
      http: this.http,
      propertyId: property.propertyId,
      isAuthenticated: this.authenticatedUser() !== null,
      getPropertyLabels: () => this.propertyLabels(),
      setPropertyLabels: (labels) => this.propertyLabels.set(labels)
    });
  }

  private async savePropertyComment(
    property: ListingPropertyRow,
    commentRaw: string
  ): Promise<void> {
    await this.listingInteractionUseCaseService.savePropertyComment({
      http: this.http,
      propertyId: property.propertyId,
      commentRaw,
      isAuthenticated: this.authenticatedUser() !== null,
      getPropertyLabels: () => this.propertyLabels(),
      setPropertyLabels: (labels) => this.propertyLabels.set(labels)
    });
  }

  private async toggleSort(sortBy: SortToggleRequest['sortBy']): Promise<void> {
    await this.listingQueryOrchestratorService.toggleSort(this.http, sortBy);
  }

  private async changePage(page: number): Promise<void> {
    await this.listingQueryOrchestratorService.changePage(this.http, page);
  }

  private async changePageSize(pageSize: number): Promise<void> {
    await this.listingQueryOrchestratorService.changePageSize(this.http, pageSize);
  }

  private navigateTo(url: string): void {
    this.locationRef.assign(url);
  }
}
