import { Component, HostListener, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import {
  I18nService,
  SupportedLanguage,
  TranslationKey
} from 'src/app/core/i18n/services/i18n.service';

@Component({
  selector: 'app-property-mini-image-carousel',
  standalone: true,
  templateUrl: './property-mini-image-carousel.component.html',
  styleUrl: './property-mini-image-carousel.component.scss'
})
export class PropertyMiniImageCarouselComponent implements OnChanges {
  private readonly i18nService = inject(I18nService);

  @Input() imageUrls: string[] = [];
  @Input() selectedLanguage: SupportedLanguage = 'en';
  selectedImageIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageUrls']) {
      this.selectedImageIndex = 0;
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.imageUrls.length === 0) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (this.isTypingTarget(target)) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.selectPreviousImage();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.selectNextImage();
    }
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  hasImages(): boolean {
    return this.imageUrls.length > 0;
  }

  currentImageUrl(): string {
    if (this.imageUrls.length === 0) {
      return '';
    }

    return this.imageUrls[this.selectedImageIndex] ?? '';
  }

  selectPreviousImage(): void {
    if (this.imageUrls.length === 0) {
      return;
    }

    this.selectedImageIndex =
      (this.selectedImageIndex - 1 + this.imageUrls.length) % this.imageUrls.length;
  }

  selectNextImage(): void {
    if (this.imageUrls.length === 0) {
      return;
    }

    this.selectedImageIndex = (this.selectedImageIndex + 1) % this.imageUrls.length;
  }

  private isTypingTarget(target: HTMLElement | null): boolean {
    if (!target) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }
}
