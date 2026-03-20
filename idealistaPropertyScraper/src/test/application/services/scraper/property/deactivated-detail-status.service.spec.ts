import { describe, expect, it, jest } from '@jest/globals';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';

import type { RuntimeClient } from 'src/ports/outbound/browser/runtime-client.port';
function createRuntime(resultValue: unknown): RuntimeClient {
  return {
    evaluate: jest.fn(async () => ({ result: { value: resultValue } }))
  };
}

describe('DeactivatedDetailStatusService', () => {
  it('whenDetailIsActive_detect_shouldReturnOpenStatus', async () => {
    // Arrange
    const service = new DeactivatedDetailStatusService();
    const runtime = createRuntime({ isDeactivated: false, closedByIso: null, rawDateText: null });
    // Action
    const result = await service.detect(runtime);
    // Assert
    expect(result).toEqual({ isDeactivated: false, closedBy: null });
  });

  it('whenDetailIsDeactivatedWithoutDate_detect_shouldReturnClosedWithoutClosedBy', async () => {
    // Arrange
    const service = new DeactivatedDetailStatusService();
    const runtime = createRuntime({ isDeactivated: true, closedByIso: null, rawDateText: 'lo ha dado de baja hoy' });
    // Action
    const result = await service.detect(runtime);
    // Assert
    expect(result).toEqual({ isDeactivated: true, closedBy: null });
  });

  it('whenClosedByIsoIsInvalid_detect_shouldReturnClosedWithoutClosedBy', async () => {
    // Arrange
    const service = new DeactivatedDetailStatusService();
    const runtime = createRuntime({ isDeactivated: true, closedByIso: 'invalid-date', rawDateText: '12/12/2024' });
    // Action
    const result = await service.detect(runtime);
    // Assert
    expect(result).toEqual({ isDeactivated: true, closedBy: null });
  });

  it('whenClosedByIsoIsValid_detect_shouldReturnClosedWithParsedDate', async () => {
    // Arrange
    const service = new DeactivatedDetailStatusService();
    const closedByIso = '2025-05-10T21:59:59.000Z';
    const runtime = createRuntime({ isDeactivated: true, closedByIso, rawDateText: '10/05/2025' });
    // Action
    const result = await service.detect(runtime);
    // Assert
    expect(result.isDeactivated).toBe(true);
    expect(result.closedBy?.toISOString()).toBe(closedByIso);
  });
});
