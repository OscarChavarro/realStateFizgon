import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Configuration } from '../../config/configuration';

type ConnectionUpdate = {
  connection?: string;
  qr?: string;
  lastDisconnect?: {
    error?: unknown;
  };
};

type IncomingMessageListener = (payload: unknown) => void | Promise<void>;

type BaileysSocket = {
  sendMessage(jid: string, payload: { text: string }): Promise<unknown>;
  end(code?: unknown): void;
  ev: {
    on(event: 'creds.update', listener: (...args: unknown[]) => void): void;
    on(event: 'connection.update', listener: (update: ConnectionUpdate) => void): void;
    on(event: 'messages.upsert', listener: (payload: unknown) => void): void;
  };
};

type BaileysModule = {
  default: (params: Record<string, unknown>) => BaileysSocket;
  useMultiFileAuthState(folderPath: string): Promise<{
    state: unknown;
    saveCreds: (...args: unknown[]) => Promise<void> | void;
  }>;
  fetchLatestBaileysVersion(): Promise<{ version: number[] }>;
  DisconnectReason?: {
    loggedOut?: number;
  };
};

@Injectable()
export class WhatsappWhiskeySocketsService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappWhiskeySocketsService.name);
  private static readonly RETRY_DELAY_MS = 5000;
  private socket: BaileysSocket | null = null;
  private isConnected = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly incomingMessageListeners = new Set<IncomingMessageListener>();

  constructor(private readonly configuration: Configuration) {}

  async initialize(): Promise<void> {
    if (this.socket && this.isConnected) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeSocketWithRetry().finally(() => {
      this.initializationPromise = null;
    });
    return this.initializationPromise;
  }

  async sendTextMessage(text: string): Promise<void> {
    if (text.trim().length === 0) {
      return;
    }

    await this.initialize();
    const destinationJid = this.configuration.whiskeySocketsWhatsappDestinationJid;
    if (destinationJid.length === 0) {
      throw new Error('Missing WhatsApp destination. Configure secrets.whiskeysocketswhatsapp.destinationJid or phoneNumber.');
    }

    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp socket is not connected.');
    }

    await this.socket.sendMessage(destinationJid, { text });
  }

  onIncomingMessage(listener: IncomingMessageListener): void {
    this.incomingMessageListeners.add(listener);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
    this.isConnected = false;
  }

  private async initializeSocket(): Promise<void> {
    const baileys = await this.loadBaileysModule();
    const authFolderPath = resolve(process.cwd(), this.configuration.whiskeySocketsWhatsappAuthFolderPath);
    await mkdir(authFolderPath, { recursive: true });

    const { state, saveCreds } = await baileys.useMultiFileAuthState(authFolderPath);
    const { version } = await baileys.fetchLatestBaileysVersion();

    const socket = baileys.default({
      auth: state,
      version,
      printQRInTerminal: false,
      markOnlineOnConnect: this.configuration.whiskeySocketsWhatsappMarkOnlineOnConnect,
      connectTimeoutMs: this.configuration.whiskeySocketsWhatsappConnectTimeoutMs,
      logger: pino({ level: 'silent' })
    });

    this.socket = socket;
    this.isConnected = false;
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('messages.upsert', (payload) => {
      for (const listener of this.incomingMessageListeners) {
        void Promise.resolve(listener(payload)).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Error handling incoming WhatsApp message: ${message}`);
        });
      }
    });

    await new Promise<void>((resolvePromise, rejectPromise) => {
      socket.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr && this.configuration.whiskeySocketsWhatsappPrintQrInTerminal) {
          this.logger.warn('Scan this QR with WhatsApp to link the device.');
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
          this.isConnected = true;
          this.logger.log('WhatsApp is connected and ready.');
          resolvePromise();
          return;
        }

        if (connection === 'close') {
          this.isConnected = false;
          const statusCode = this.extractStatusCode(lastDisconnect?.error);
          const message = statusCode
            ? `WhatsApp connection closed with status code ${statusCode}.`
            : 'WhatsApp connection closed before becoming ready.';

          const loggedOutCode = baileys.DisconnectReason?.loggedOut ?? 401;
          if (statusCode === loggedOutCode) {
            this.logger.error(`${message} Session was logged out; QR scan is required on next startup.`);
          } else {
            this.logger.error(message);
          }

          this.socket = null;
          rejectPromise(new Error(message));
        }
      });
    });
  }

  private async initializeSocketWithRetry(): Promise<void> {
    while (true) {
      try {
        await this.initializeSocket();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`WhatsApp initialization failed: ${message}. Retrying in ${WhatsappWhiskeySocketsService.RETRY_DELAY_MS}ms.`);
        await this.sleep(WhatsappWhiskeySocketsService.RETRY_DELAY_MS);
      }
    }
  }

  private async loadBaileysModule(): Promise<BaileysModule> {
    const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<unknown>;
    const module = await dynamicImport('@whiskeysockets/baileys');
    return module as BaileysModule;
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const errorObject = error as { output?: { statusCode?: unknown } };
    const statusCode = errorObject.output?.statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
