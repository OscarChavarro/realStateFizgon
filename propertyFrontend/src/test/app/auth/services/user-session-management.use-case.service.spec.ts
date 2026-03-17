import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';

class UserSessionManagementUseCaseServiceMockFactory {
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
    const coordinator =
      UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(
      coordinator as unknown as SessionCoordinatorService
    );

    // Action
    await service.logoutCurrentUser();

    // Assert
    expect(coordinator.logoutAndReset).toHaveBeenCalledTimes(1);
  });

  it('whenLoadingUsers_loadUsers_shouldDelegateToSessionCoordinator', async () => {
    // Arrange
    const coordinator =
      UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(
      coordinator as unknown as SessionCoordinatorService
    );

    // Action
    await service.loadUsers();

    // Assert
    expect(coordinator.loadUsers).toHaveBeenCalledTimes(1);
  });

  it('whenDeletingUser_deleteUserAndRefresh_shouldDelegateToSessionCoordinator', async () => {
    // Arrange
    const coordinator =
      UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(
      coordinator as unknown as SessionCoordinatorService
    );

    // Action
    await service.deleteUserAndRefresh('user-2');

    // Assert
    expect(coordinator.deleteUserAndRefresh).toHaveBeenCalledOnceWith('user-2');
  });
});
