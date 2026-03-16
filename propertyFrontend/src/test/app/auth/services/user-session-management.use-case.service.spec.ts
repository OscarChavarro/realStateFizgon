import { HttpClient } from '@angular/common/http';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';

class UserSessionManagementUseCaseServiceMockFactory {
  static createHttpClientMock(): HttpClient {
    return {} as HttpClient;
  }

  static createSessionCoordinatorMock() {
    return {
      logoutAndReset: jasmine.createSpy('logoutAndReset').and.resolveTo(undefined),
      loadUsers: jasmine.createSpy('loadUsers').and.resolveTo(undefined),
      deleteUserAndRefresh: jasmine.createSpy('deleteUserAndRefresh').and.resolveTo(undefined)
    };
  }
}

describe('UserSessionManagementUseCaseService', () => {
  it('whenLoggingOut_logoutCurrentUser_shouldDelegateToSessionCoordinator', async () => {
    // Arrange
    const coordinator = UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(coordinator as unknown as SessionCoordinatorService);
    const http = UserSessionManagementUseCaseServiceMockFactory.createHttpClientMock();

    // Action
    await service.logoutCurrentUser(http);

    // Assert
    expect(coordinator.logoutAndReset).toHaveBeenCalledOnceWith(http);
  });

  it('whenLoadingUsers_loadUsers_shouldDelegateToSessionCoordinator', async () => {
    // Arrange
    const coordinator = UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(coordinator as unknown as SessionCoordinatorService);
    const http = UserSessionManagementUseCaseServiceMockFactory.createHttpClientMock();

    // Action
    await service.loadUsers(http);

    // Assert
    expect(coordinator.loadUsers).toHaveBeenCalledOnceWith(http);
  });

  it('whenDeletingUser_deleteUserAndRefresh_shouldDelegateToSessionCoordinator', async () => {
    // Arrange
    const coordinator = UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(coordinator as unknown as SessionCoordinatorService);
    const http = UserSessionManagementUseCaseServiceMockFactory.createHttpClientMock();

    // Action
    await service.deleteUserAndRefresh(http, 'user-2');

    // Assert
    expect(coordinator.deleteUserAndRefresh).toHaveBeenCalledOnceWith(http, 'user-2');
  });
});
