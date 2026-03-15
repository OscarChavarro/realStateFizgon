import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

export class GoogleMapMarkerIconFactory {
  buildPropertyMarkerIconDataUrl(property: GoogleMapProperty): string {
    const isClosed = property.closed === true;
    const baseColor = isClosed
      ? '#4b5563'
      : this.resolveReviewMarkerColor(property.review);
    const glyph = isClosed
      ? '<text x="19" y="25.5" text-anchor="middle" dominant-baseline="middle" font-size="16" fill="#ffffff">☠</text>'
      : `
        <path fill="#ffffff" d="M8.5 17.5 19 9l10.5 8.5-1.9 2.3-1.6-1.3V29h-5.8v-6.6h-2.4V29H12V18.5l-1.6 1.3-1.9-2.3z"/>
        <rect x="17" y="23" width="4" height="6" fill="${baseColor}"/>
        <rect x="13.8" y="18.4" width="3.2" height="3" fill="${baseColor}"/>
        <rect x="21" y="18.4" width="3.2" height="3" fill="${baseColor}"/>
      `;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r="18" fill="${baseColor}"/>
        ${glyph}
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  buildSelectedTargetMarkerIconDataUrl(): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="rgba(255, 214, 10, 0.25)" stroke="#ffd60a" stroke-width="4"/>
        <text x="28" y="35" text-anchor="middle" dominant-baseline="middle" font-size="22">🎯</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private resolveReviewMarkerColor(review: GoogleMapProperty['review']): string {
    if (review === 'FAVOURITE') {
      return '#20a24a';
    }

    if (review === 'DISCHARGED') {
      return '#d44343';
    }

    return '#9ca3af';
  }
}
