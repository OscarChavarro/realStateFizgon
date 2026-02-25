import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappMessageFormatter {
  format(message: unknown): string {
    if (!message || typeof message !== 'object') {
      return String(message ?? '');
    }

    const typedMessage = message as { title?: unknown; url?: unknown };
    const rawTitle = typeof typedMessage.title === 'string' ? typedMessage.title : '';
    const title = this.simplifyPropertyTitle(rawTitle);
    const url = typeof typedMessage.url === 'string' ? typedMessage.url : '';

    if (title.length > 0 && url.length > 0) {
      return `${title}\n${url}`;
    }
    if (url.length > 0) {
      return url;
    }
    if (title.length > 0) {
      return title;
    }

    return '';
  }

  simplifyPropertyTitle(title: string): string {
    return title.replace(/^Alquiler de piso en\s*/i, '').trim();
  }
}
