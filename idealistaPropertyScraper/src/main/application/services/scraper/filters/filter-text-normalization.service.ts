import { Injectable } from '@nestjs/common';

@Injectable()
export class FilterTextNormalizationService {
  normalizeComparableText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/Desplegar/gi, '')
      .trim()
      .toLowerCase();
  }
}
