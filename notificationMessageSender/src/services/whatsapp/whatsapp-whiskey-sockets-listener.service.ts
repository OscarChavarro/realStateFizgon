import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Configuration } from '../../config/configuration';
import { WhatsappWhiskeySocketsService } from './whatsapp-whiskey-sockets.service';

@Injectable()
export class WhatsappWhiskeySocketsListenerService implements OnModuleDestroy {
  private messagesReceivedLastMinute = 0;
  private readonly reportInterval: NodeJS.Timeout | null;

  constructor(
    private readonly configuration: Configuration,
    private readonly whatsappWhiskeySocketsService: WhatsappWhiskeySocketsService
  ) {
    this.whatsappWhiskeySocketsService.onIncomingMessage((payload) => {
      this.handleIncomingMessage(payload);
    });

    this.reportInterval = this.configuration.whatsappMessageReceiveMode === 'REPORT'
      ? setInterval(() => this.flushReport(), 60000)
      : null;
  }

  onModuleDestroy(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
  }

  private handleIncomingMessage(payload: unknown): void {
    const mode = this.configuration.whatsappMessageReceiveMode;
    if (mode === 'IGNORE') {
      return;
    }

    if (mode === 'JSON') {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    if (mode === 'REPORT') {
      this.messagesReceivedLastMinute += 1;
      return;
    }

    const conversations = this.extractConversationTexts(payload);
    for (const conversation of conversations) {
      if (conversation.trim().length > 0) {
        console.log(conversation);
      }
    }
  }

  private flushReport(): void {
    if (this.messagesReceivedLastMinute > 0) {
      console.log(`${this.messagesReceivedLastMinute} messages received the last minute`);
      this.messagesReceivedLastMinute = 0;
    }
  }

  private extractConversationTexts(payload: unknown): string[] {
    const collected = new Set<string>();
    const stack: unknown[] = [payload];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') {
        continue;
      }

      const typed = current as Record<string, unknown>;
      const conversation = typed.conversation;
      if (typeof conversation === 'string' && conversation.trim().length > 0) {
        collected.add(conversation);
      }

      for (const value of Object.values(typed)) {
        if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }

    return Array.from(collected);
  }
}
