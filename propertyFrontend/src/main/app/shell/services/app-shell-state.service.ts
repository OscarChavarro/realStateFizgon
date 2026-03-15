import { Injectable, computed, signal } from '@angular/core';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { ListingFiltersState, createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { createDefaultListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';
import { ListingPropertyRow, ListingTab, PropertyLabelEntry, SortCriterion } from 'src/app/listing/model/listing.types';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';

@Injectable({
  providedIn: 'root'
})
export class AppShellStateService {
  readonly backendBaseUrl = signal<string>(ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL);
  readonly staticMediaBaseUrl = signal<string>(ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL);
  readonly googleMapsApiKey = signal<string | null>(null);
  readonly googleMapsMapId = signal<string | null>(null);

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly allProperties = signal<ListingPropertyRow[]>([]);
  readonly filters = signal<ListingFiltersState>(createDefaultListingFilters());
  readonly pagination = signal(createDefaultListingPaginationState());
  readonly properties = computed<ListingPropertyRow[]>(() => this.allProperties());
  readonly filteredTotalElements = signal<number>(0);
  readonly visibleCount = computed<number>(() => this.filteredTotalElements());
  readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly activeTab = signal<ListingTab>('DASHBOARD');
  readonly googleLoginEnabled = signal<boolean>(true);
  readonly authenticatedUser = signal<AuthenticatedUser | null>(null);
  readonly canEditUsers = computed<boolean>(() =>
    this.authenticatedUser()?.permissions?.includes('canEditUsers') === true
  );
  readonly canMaintainDatabase = computed<boolean>(() =>
    this.authenticatedUser()?.permissions?.includes('canMaintainDatabase') === true
  );
  readonly authenticatedUserAvatarUrl = computed<string | null>(() =>
    this.authenticatedUser() ? `${this.backendBaseUrl()}/auth/google/avatar` : null
  );
  readonly users = signal<AuthUserListItem[]>([]);
  readonly usersLoading = signal<boolean>(false);
  readonly propertyLabels = signal<PropertyLabelEntry[]>([]);
  readonly maintenanceOperations: DatabaseMaintenanceOperation[] = [
    new RemoveDanglingImagesOperation()
  ];
  readonly maintenanceRunning = signal<boolean>(false);
  readonly maintenanceResultText = signal<string>('');
  readonly sortCriteria = signal<SortCriterion[]>([]);
  readonly selectedProperty = this.propertySelectionService.selectedProperty;
  readonly lockedSelectedPropertyKey = this.propertySelectionService.lockedSelectedPropertyKey;
  readonly leftPanelWidthPercent = this.workspaceInteractionCoordinatorService.leftPanelWidthPercent;
  readonly leftPanelHidden = this.workspaceInteractionCoordinatorService.leftPanelHidden;
  readonly rightPanelHidden = this.workspaceInteractionCoordinatorService.rightPanelHidden;

  constructor(
    private readonly propertySelectionService: PropertySelectionService,
    private readonly workspaceInteractionCoordinatorService: WorkspaceInteractionCoordinatorService
  ) {}
}
