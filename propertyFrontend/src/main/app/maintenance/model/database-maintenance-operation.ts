import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslationKey } from 'src/app/core/i18n/services/i18n.service';

type DatabaseMaintenanceOperationResult = {
  status: number;
  body: unknown;
};

export abstract class DatabaseMaintenanceOperation {
  constructor(
    public readonly i18nId: TranslationKey,
    private readonly endpointPath: string
  ) {}

  async execute(http: HttpClient): Promise<DatabaseMaintenanceOperationResult> {
    const endpointUrl = this.buildEndpointUrl();
    const response = await firstValueFrom(http.get<unknown>(endpointUrl, { observe: 'response' }));

    return this.toResult(response);
  }

  private toResult(response: HttpResponse<unknown>): DatabaseMaintenanceOperationResult {
    return {
      status: response.status,
      body: response.body
    };
  }

  private buildEndpointUrl(): string {
    return this.endpointPath.startsWith('/') ? this.endpointPath : `/${this.endpointPath}`;
  }
}
