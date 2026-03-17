import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoogleMapSelectionOverlayComponent } from 'src/app/core/maps/components/google-map-selection-overlay/google-map-selection-overlay.component';
import { PropertyMiniSummaryComponent } from 'src/app/core/maps/components/property-mini-summary/property-mini-summary.component';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

describe('GoogleMapSelectionOverlayComponent', () => {
  let fixture: ComponentFixture<GoogleMapSelectionOverlayComponent>;
  let component: GoogleMapSelectionOverlayComponent;

  function createProperty(): GoogleMapProperty {
    return {
      id: 'property-1',
      propertyId: '1',
      title: 'Property 1',
      price: '1500',
      latitude: 40.4,
      longitude: -3.7,
      closed: false,
      review: 'NEW',
      imageUrls: []
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GoogleMapSelectionOverlayComponent]
    });

    fixture = TestBed.createComponent(GoogleMapSelectionOverlayComponent);
    component = fixture.componentInstance;
    component.property = createProperty();
    component.selectedLanguage = 'sp';
    fixture.detectChanges();
  });

  it('should pass property and language to the mini summary component', () => {
    // Arrange
    const miniSummary = fixture.debugElement.query(
      By.directive(PropertyMiniSummaryComponent)
    ).componentInstance as PropertyMiniSummaryComponent;

    // Action
    const propertyId = miniSummary.property.propertyId;
    const selectedLanguage = miniSummary.selectedLanguage;

    // Assert
    expect(propertyId).toBe('1');
    expect(selectedLanguage).toBe('sp');
  });

  it('should emit closeRequested when mini summary requests close', () => {
    // Arrange
    const emitted: number[] = [];
    component.closeRequested.subscribe(() => emitted.push(1));
    const miniSummary = fixture.debugElement.query(
      By.directive(PropertyMiniSummaryComponent)
    ).componentInstance as PropertyMiniSummaryComponent;

    // Action
    miniSummary.closeRequested.emit();

    // Assert
    expect(emitted.length).toBe(1);
  });
});
