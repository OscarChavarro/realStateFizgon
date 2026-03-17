import { TestBed } from '@angular/core/testing';
import { MaintenancePanelComponent } from 'src/app/maintenance/components/maintenance-panel/maintenance-panel.component';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';

class MaintenancePanelComponentMockFactory {
  static createI18nMock() {
    return {
      get: jasmine
        .createSpy('get')
        .and.callFake((id: string, language: string) => `${id}:${language}`)
    };
  }

  static createComponent(i18nMock: { get: jasmine.Spy }): MaintenancePanelComponent {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18nMock }]
    });
    return TestBed.runInInjectionContext(() => new MaintenancePanelComponent());
  }
}

describe('MaintenancePanelComponent', () => {
  it('requestOperation should emit selected operation', () => {
    // Arrange
    const i18nMock = MaintenancePanelComponentMockFactory.createI18nMock();
    const component = MaintenancePanelComponentMockFactory.createComponent(i18nMock);
    const operation = new RemoveDanglingImagesOperation();
    const emitSpy = spyOn(component.operationRequested, 'emit');

    // Action
    component.requestOperation(operation);

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(operation);
  });

  it('t should delegate translation lookup', () => {
    // Arrange
    const i18nMock = MaintenancePanelComponentMockFactory.createI18nMock();
    const component = MaintenancePanelComponentMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.t('shell.DATABASE_MAINTENANCE_TAB');

    // Assert
    expect(i18nMock.get).toHaveBeenCalledOnceWith('shell.DATABASE_MAINTENANCE_TAB', 'sp');
    expect(result).toBe('shell.DATABASE_MAINTENANCE_TAB:sp');
  });
});
