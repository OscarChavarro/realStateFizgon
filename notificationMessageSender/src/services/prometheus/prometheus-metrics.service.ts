import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

@Injectable()
export class PrometheusMetricsService {
  private readonly registry: Registry;
  private readonly whatsappMessagesSentSuccessTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.whatsappMessagesSentSuccessTotal = new Counter({
      name: 'notification_message_sender_whatsapp_messages_sent_success_total',
      help: 'Total successful WhatsApp sends.',
      registers: [this.registry]
    });
  }

  incrementWhatsappMessagesSentSuccess(): void {
    this.whatsappMessagesSentSuccessTotal.inc();
  }

  metricsContentType(): string {
    return this.registry.contentType;
  }

  async renderMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
