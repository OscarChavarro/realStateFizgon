import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Environment = {
  rabbitmq: {
    host: string;
    port: number;
  };
  notificaton?: {
    postMessageSentWaitInMs?: number;
  };
  whiskeysocketswhatsapp?: {
    authFolderPath?: string;
    printQrInTerminal?: boolean;
    markOnlineOnConnect?: boolean;
    connectTimeoutMs?: number;
  };
};

type Secrets = {
  rabbitmq?: {
    host?: string;
    port?: number;
    vhost?: string;
    queue?: string;
    user?: string;
    password?: string;
  };
  whiskeysocketswhatsapp?: {
    phoneNumber?: string;
    destinationJid?: string;
  };
};

@Injectable()
export class Configuration {
  private readonly environment: Environment;
  private readonly secrets: Secrets;

  constructor() {
    const raw = readFileSync(join(process.cwd(), 'environment.json'), 'utf-8');
    this.environment = JSON.parse(raw) as Environment;

    const secretsPath = join(process.cwd(), 'secrets.json');
    if (!existsSync(secretsPath)) {
      console.log('Copy secrets-example.json to secrets.json and define external services credentials for this micro service.');
      process.exit(1);
    }

    const secretsRaw = readFileSync(secretsPath, 'utf-8');
    this.secrets = JSON.parse(secretsRaw) as Secrets;
  }

  get rabbitMqHost(): string {
    return this.secrets.rabbitmq?.host ?? this.environment.rabbitmq?.host ?? 'localhost';
  }

  get rabbitMqPort(): number {
    return this.secrets.rabbitmq?.port ?? this.environment.rabbitmq?.port ?? 5672;
  }

  get rabbitMqVhost(): string {
    return this.secrets.rabbitmq?.vhost ?? 'dev';
  }

  get rabbitMqQueue(): string {
    return this.secrets.rabbitmq?.queue ?? 'outgoing-notification-messages';
  }

  get rabbitMqUser(): string {
    return this.secrets.rabbitmq?.user ?? '';
  }

  get rabbitMqPassword(): string {
    return this.secrets.rabbitmq?.password ?? '';
  }

  get notificationPostMessageSentWaitInMs(): number {
    return Math.max(0, this.environment.notificaton?.postMessageSentWaitInMs ?? 3600000);
  }

  get whiskeySocketsWhatsappAuthFolderPath(): string {
    return this.environment.whiskeysocketswhatsapp?.authFolderPath ?? './output/whatsapp-auth';
  }

  get whiskeySocketsWhatsappPrintQrInTerminal(): boolean {
    return this.environment.whiskeysocketswhatsapp?.printQrInTerminal ?? true;
  }

  get whiskeySocketsWhatsappMarkOnlineOnConnect(): boolean {
    return this.environment.whiskeysocketswhatsapp?.markOnlineOnConnect ?? false;
  }

  get whiskeySocketsWhatsappConnectTimeoutMs(): number {
    return Math.max(1000, this.environment.whiskeysocketswhatsapp?.connectTimeoutMs ?? 60000);
  }

  get whiskeySocketsWhatsappPhoneNumber(): string {
    return this.secrets.whiskeysocketswhatsapp?.phoneNumber ?? '';
  }

  get whiskeySocketsWhatsappDestinationJid(): string {
    const explicit = this.secrets.whiskeysocketswhatsapp?.destinationJid?.trim() ?? '';
    if (explicit.length > 0) {
      return explicit;
    }

    const phoneNumber = this.whiskeySocketsWhatsappPhoneNumber.replace(/\D/g, '');
    if (phoneNumber.length === 0) {
      return '';
    }

    return `${phoneNumber}@s.whatsapp.net`;
  }
}
