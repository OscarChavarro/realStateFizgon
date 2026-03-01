import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';

@Component({
  selector: 'app-property-image-carousel',
  standalone: true,
  templateUrl: './property-image-carousel.component.html',
  styleUrl: './property-image-carousel.component.css'
})
export class PropertyImageCarouselComponent implements OnChanges {
  @Input() propertyId = '';
  @Input() localImageUrls: string[] = [];
  @Input() staticMediaBaseUrl = 'http://localhost:666/';
  @ViewChild('thumbnailStrip') thumbnailStrip?: ElementRef<HTMLDivElement>;
  @ViewChildren('thumbnailButton') thumbnailButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  selectedImageIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['propertyId'] || changes['localImageUrls']) {
      this.selectedImageIndex = 0;
      this.ensureSelectedThumbnailVisible();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.localImageUrls.length === 0) {
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

  selectImage(index: number): void {
    if (index < 0 || index >= this.localImageUrls.length) {
      return;
    }

    this.selectedImageIndex = index;
    this.ensureSelectedThumbnailVisible();
  }

  selectPreviousImage(): void {
    if (this.localImageUrls.length === 0) {
      return;
    }

    const previousIndex =
      (this.selectedImageIndex - 1 + this.localImageUrls.length) % this.localImageUrls.length;
    this.selectedImageIndex = previousIndex;
    this.ensureSelectedThumbnailVisible();
  }

  selectNextImage(): void {
    if (this.localImageUrls.length === 0) {
      return;
    }

    const nextIndex = (this.selectedImageIndex + 1) % this.localImageUrls.length;
    this.selectedImageIndex = nextIndex;
    this.ensureSelectedThumbnailVisible();
  }

  getSelectedImageSrc(): string {
    if (this.localImageUrls.length === 0) {
      return '';
    }

    return this.buildLocalImageSrc(this.localImageUrls[this.selectedImageIndex]);
  }

  buildLocalImageSrc(localImageUrl: string): string {
    const base = this.staticMediaBaseUrl.endsWith('/')
      ? this.staticMediaBaseUrl
      : `${this.staticMediaBaseUrl}/`;
    return `${base}${this.propertyId}/${localImageUrl}`;
  }

  private ensureSelectedThumbnailVisible(): void {
    requestAnimationFrame(() => {
      const strip = this.thumbnailStrip?.nativeElement;
      const buttons = this.thumbnailButtons?.toArray() ?? [];
      const targetButton = buttons[this.selectedImageIndex]?.nativeElement;
      if (!strip || !targetButton) {
        return;
      }

      const targetLeft = targetButton.offsetLeft;
      const targetWidth = targetButton.offsetWidth;
      const stripWidth = strip.clientWidth;
      const maxScrollLeft = Math.max(0, strip.scrollWidth - stripWidth);
      const centeredScrollLeft = targetLeft - (stripWidth / 2) + (targetWidth / 2);
      const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, centeredScrollLeft));

      strip.scrollTo({
        left: nextScrollLeft,
        behavior: 'smooth'
      });
    });
  }

  private isTypingTarget(target: HTMLElement | null): boolean {
    if (!target) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input'
      || tagName === 'textarea'
      || tagName === 'select'
      || target.isContentEditable;
  }
}
