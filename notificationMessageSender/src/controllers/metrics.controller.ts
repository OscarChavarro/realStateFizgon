import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusMetricsService } from '../services/prometheus/prometheus-metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly prometheusMetricsService: PrometheusMetricsService) {}

  @Get('/health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('/metrics')
  async metrics(@Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }): Promise<string> {
    response.setHeader('Content-Type', this.prometheusMetricsService.metricsContentType());
    return await this.prometheusMetricsService.renderMetrics();
  }
}
