import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

@Component({
  selector: 'app-property-mini-summary',
  standalone: true,
  templateUrl: './property-mini-summary.component.html',
  styleUrl: './property-mini-summary.component.scss'
})
export class PropertyMiniSummaryComponent {
  @Input({ required: true }) property!: GoogleMapProperty;
  @Output() readonly closeRequested = new EventEmitter<void>();

  onCloseClick(): void {
    this.closeRequested.emit();
  }
}

