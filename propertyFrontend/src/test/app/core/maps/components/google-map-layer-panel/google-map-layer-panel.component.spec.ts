import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoogleMapLayerPanelComponent } from 'src/app/core/maps/components/google-map-layer-panel/google-map-layer-panel.component';
import { GoogleMapLayerOption } from 'src/app/core/maps/model/google-map-layers.model';

describe('GoogleMapLayerPanelComponent', () => {
  let fixture: ComponentFixture<GoogleMapLayerPanelComponent>;
  let component: GoogleMapLayerPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GoogleMapLayerPanelComponent]
    });

    fixture = TestBed.createComponent(GoogleMapLayerPanelComponent);
    component = fixture.componentInstance;
    component.selectedLanguage = 'en';
    component.layerOptions = [
      {
        id: 'business',
        label: 'map.PROPERTY_LOCATION_LAYER_BUSINESS',
        mapFeatureStyles: []
      }
    ] satisfies GoogleMapLayerOption[];
    component.mapVisualStyleOptions = [
      {
        id: 'vector',
        label: 'map.PROPERTY_LOCATION_STYLE_VECTOR'
      },
      {
        id: 'hybrid',
        label: 'map.PROPERTY_LOCATION_STYLE_HYBRID'
      }
    ];
    component.selectedMapVisualStyle = 'hybrid';
    component.isLayerEnabled = () => true;
    fixture.detectChanges();
  });

  it('should render translated layer and style labels', () => {
    // Arrange
    const root = fixture.nativeElement as HTMLElement;

    // Action
    const text = root.textContent ?? '';

    // Assert
    expect(text).toContain('Layers');
    expect(text).toContain('Business');
    expect(text).toContain('Styles');
    expect(text).toContain('Hybrid');
  });

  it('should emit layer toggle payload when checkbox changes', () => {
    // Arrange
    const emitted: Array<{ id: string; checked: boolean }> = [];
    component.layerToggle.subscribe((event) => emitted.push(event));
    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = false;

    // Action
    checkbox.dispatchEvent(new Event('change'));

    // Assert
    expect(emitted).toEqual([{ id: 'business', checked: false }]);
  });

  it('should emit map visual style when radio option changes', () => {
    // Arrange
    const emitted: string[] = [];
    component.mapVisualStyleChange.subscribe((event) => emitted.push(event));
    const radios = fixture.nativeElement.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
    radios[0].checked = true;

    // Action
    radios[0].dispatchEvent(new Event('change'));

    // Assert
    expect(emitted).toEqual(['vector']);
  });

  it('should fallback to default isLayerEnabled implementation when input is not provided', () => {
    // Arrange
    const fallbackFixture = TestBed.createComponent(GoogleMapLayerPanelComponent);
    const fallbackComponent = fallbackFixture.componentInstance;
    fallbackComponent.selectedLanguage = 'en';
    fallbackComponent.layerOptions = component.layerOptions;
    fallbackComponent.mapVisualStyleOptions = component.mapVisualStyleOptions;
    fallbackComponent.selectedMapVisualStyle = 'hybrid';
    fallbackFixture.detectChanges();

    // Action
    const enabled = fallbackComponent.isLayerEnabled('business');

    // Assert
    expect(enabled).toBeFalse();
  });
});
