import { Injectable } from '@nestjs/common';
import { RuntimeClient } from './cdp-client.types';

type DeactivatedDetailDetectionResult = {
  isDeactivated: boolean;
  closedByIso: string | null;
  rawDateText: string | null;
};

type DeactivatedDetailStatus = {
  isDeactivated: boolean;
  closedBy: Date | null;
};

@Injectable()
export class DeactivatedDetailStatusService {
  private static readonly DEACTIVATED_DETAIL_SELECTOR = 'section.deactivated-detail, .deactivated-detail_container_new';
  private static readonly DEACTIVATED_DATE_SELECTOR = '.deactivated-detail_date';

  async detect(runtime: RuntimeClient): Promise<DeactivatedDetailStatus> {
    const result = await this.evaluateExpression<DeactivatedDetailDetectionResult>(runtime, `(() => {
      const root = document.querySelector(${JSON.stringify(DeactivatedDetailStatusService.DEACTIVATED_DETAIL_SELECTOR)});
      const bodyText = (document.body?.innerText || '').toLowerCase();

      const isDeactivatedByText = bodyText.includes('este anuncio ya no está publicado')
        || bodyText.includes('anuncio ya no está publicado');
      const isDeactivated = Boolean(root) || isDeactivatedByText;

      if (!isDeactivated) {
        return {
          isDeactivated: false,
          closedByIso: null,
          rawDateText: null
        };
      }

      const dateElement = document.querySelector(${JSON.stringify(DeactivatedDetailStatusService.DEACTIVATED_DATE_SELECTOR)});
      const rawDateText = (dateElement?.textContent || '').replace(/\\s+/g, ' ').trim() || null;
      if (!rawDateText) {
        return {
          isDeactivated: true,
          closedByIso: null,
          rawDateText: null
        };
      }

      const normalized = rawDateText.toLowerCase();
      if (normalized.includes('lo ha dado de baja hoy')) {
        return {
          isDeactivated: true,
          closedByIso: null,
          rawDateText
        };
      }

      const explicitDateMatch = rawDateText.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})/);
      if (!explicitDateMatch) {
        return {
          isDeactivated: true,
          closedByIso: null,
          rawDateText
        };
      }

      const day = Number(explicitDateMatch[1]);
      const month = Number(explicitDateMatch[2]);
      const year = Number(explicitDateMatch[3]);
      const closedBy = new Date(year, month - 1, day, 23, 59, 59, 0);
      if (Number.isNaN(closedBy.getTime())) {
        return {
          isDeactivated: true,
          closedByIso: null,
          rawDateText
        };
      }

      return {
        isDeactivated: true,
        closedByIso: closedBy.toISOString(),
        rawDateText
      };
    })()`);

    if (!result.isDeactivated) {
      return {
        isDeactivated: false,
        closedBy: null
      };
    }

    if (!result.closedByIso) {
      return {
        isDeactivated: true,
        closedBy: null
      };
    }

    const parsedDate = new Date(result.closedByIso);
    if (Number.isNaN(parsedDate.getTime())) {
      return {
        isDeactivated: true,
        closedBy: null
      };
    }

    return {
      isDeactivated: true,
      closedBy: parsedDate
    };
  }

  private async evaluateExpression<T>(runtime: RuntimeClient, expression: string): Promise<T> {
    const response = await runtime.evaluate({
      expression,
      returnByValue: true
    });

    return response.result?.value as T;
  }
}

