import { Injectable } from '@nestjs/common';

type PublicationTimeUnit = 'minute' | 'hour' | 'day' | 'month' | 'year';

type ParsedPublicationAge = {
  amount: number;
  unit: PublicationTimeUnit;
};

@Injectable()
export class MongoPublicationDateMapperService {
  private static readonly PREFIX = 'anuncio actualizado hace ';
  private static readonly VALUE_AND_UNIT_PATTERN = /^(un|una|\d+)\s+(minuto|minutos|hora|horas|dia|dias|mes|meses|ano|anos)$/i;

  mapPublicationDate(publicationAge: string | null, now: Date = new Date()): Date | null {
    if (!publicationAge) {
      return null;
    }

    const normalized = this.normalize(publicationAge);
    if (!normalized.startsWith(MongoPublicationDateMapperService.PREFIX)) {
      return null;
    }

    let ageText = normalized.slice(MongoPublicationDateMapperService.PREFIX.length).trim();
    if (ageText.startsWith('mas de ')) {
      ageText = ageText.slice('mas de '.length).trim();
    }

    const parsed = this.parseAgeText(ageText);
    if (!parsed) {
      return null;
    }

    return this.subtractAge(now, parsed);
  }

  private normalize(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private parseAgeText(ageText: string): ParsedPublicationAge | null {
    const match = ageText.match(MongoPublicationDateMapperService.VALUE_AND_UNIT_PATTERN);
    if (!match) {
      return null;
    }

    const amountToken = match[1];
    const unitToken = match[2];
    const amount = amountToken === 'un' || amountToken === 'una'
      ? 1
      : Number.parseInt(amountToken, 10);

    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const unit = this.mapUnit(unitToken);
    if (!unit) {
      return null;
    }

    return { amount, unit };
  }

  private mapUnit(unitToken: string): PublicationTimeUnit | null {
    if (unitToken === 'minuto' || unitToken === 'minutos') {
      return 'minute';
    }
    if (unitToken === 'hora' || unitToken === 'horas') {
      return 'hour';
    }
    if (unitToken === 'dia' || unitToken === 'dias') {
      return 'day';
    }
    if (unitToken === 'mes' || unitToken === 'meses') {
      return 'month';
    }
    if (unitToken === 'ano' || unitToken === 'anos') {
      return 'year';
    }
    return null;
  }

  private subtractAge(reference: Date, parsed: ParsedPublicationAge): Date {
    const result = new Date(reference.getTime());
    if (parsed.unit === 'minute') {
      result.setUTCMinutes(result.getUTCMinutes() - parsed.amount);
      return result;
    }
    if (parsed.unit === 'hour') {
      result.setUTCHours(result.getUTCHours() - parsed.amount);
      return result;
    }
    if (parsed.unit === 'day') {
      result.setUTCDate(result.getUTCDate() - parsed.amount);
      return result;
    }
    if (parsed.unit === 'month') {
      result.setUTCMonth(result.getUTCMonth() - parsed.amount);
      return result;
    }
    result.setUTCFullYear(result.getUTCFullYear() - parsed.amount);
    return result;
  }
}
