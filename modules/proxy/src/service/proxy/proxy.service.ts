import net from 'node:net';

export type ProxyValidationOptions = {
  enabled: boolean;
  host: string;
  port: number | string;
  retryWaitMs: number;
  connectTimeoutMs?: number;
  quickRetryCount?: number;
  quickRetryDelayMs?: number;
  testConnectHost?: string;
  testConnectPort?: number;
  logger?: {
    log(message: string): void;
    error(message: string): void;
  };
};

export class ProxyService {
  async validateProxyAccessOrWait(options: ProxyValidationOptions): Promise<void> {
    const logger = options?.logger;
    const logMessage = (message: string): void => {
      if (logger) {
        logger.log(message);
        return;
      }
      console.log(message);
    };
    const logError = (message: string): void => {
      if (logger) {
        logger.error(message);
        return;
      }
      console.error(message);
    };

    if (!options || !options.enabled) {
      logMessage('Proxy is disabled. Using direct internet connection (no proxy).');
      return;
    }

    const host = String(options.host || '').trim();
    const port = Number(options.port);
    const waitMs = Number(options.retryWaitMs) || 3600000;
    const connectTimeoutMs = Number(options.connectTimeoutMs) || 15000;
    const quickRetryCount = Math.max(1, Number(options.quickRetryCount) || 6);
    const quickRetryDelayMs = Math.max(250, Number(options.quickRetryDelayMs) || 3000);
    const testConnectHost = String(options.testConnectHost || 'example.com').trim();
    const testConnectPort = Math.max(1, Number(options.testConnectPort) || 443);
    const waitSeconds = Math.floor(waitMs / 1000);

    if (!host || !Number.isFinite(port) || port <= 0) {
      logError('Proxy is enabled but host/port are invalid. Check secrets.json proxy.host and proxy.port.');
      logError(`Keeping pod alive for ${waitSeconds} seconds before retrying proxy validation for debugging.`);
      await this.sleep(waitMs);
      return this.validateProxyAccessOrWait(options);
    }

    while (true) {
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= quickRetryCount; attempt += 1) {
        try {
          await this.checkTcpConnectivity(host, port, connectTimeoutMs);
          await this.checkHttpConnectTunnel(host, port, testConnectHost, testConnectPort, connectTimeoutMs);
          logMessage(`Proxy connectivity check passed for ${host}:${port}.`);
          logMessage(`Proxy is active and will be used for browser traffic: ${host}:${port}.`);
          return;
        } catch (caughtError) {
          lastError = caughtError;
          const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
          logError(
            `Proxy connectivity check failed for ${host}:${port} (attempt ${attempt}/${quickRetryCount}): ${message}`
          );
          if (attempt < quickRetryCount) {
            await this.sleep(quickRetryDelayMs);
          }
        }
      }

      const message = lastError instanceof Error ? lastError.message : String(lastError);
      logError(`Proxy connectivity check failed after ${quickRetryCount} quick retries for ${host}:${port}: ${message}`);
      logError(
        `No access to configured proxy. Keeping pod alive for ${waitSeconds} seconds before retrying for Kubernetes debugging.`
      );
      await this.sleep(waitMs);
    }
  }

  private checkTcpConnectivity(host: string, port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      const cleanup = (): void => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(timeoutMs);

      socket.once('connect', () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      });

      socket.once('timeout', () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`timeout after ${timeoutMs}ms`));
      });

      socket.once('error', (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });

      socket.connect(port, host);
    });
  }

  private checkHttpConnectTunnel(
    proxyHost: string,
    proxyPort: number,
    targetHost: string,
    targetPort: number,
    timeoutMs: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;
      let responseBuffer = '';

      const cleanup = (): void => {
        socket.removeAllListeners();
        socket.destroy();
      };

      const fail = (reason: string): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(reason));
      };

      socket.setTimeout(timeoutMs);

      socket.once('connect', () => {
        const request =
          `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
          `Host: ${targetHost}:${targetPort}\r\n` +
          'Proxy-Connection: Keep-Alive\r\n' +
          '\r\n';
        socket.write(request);
      });

      socket.on('data', (chunk: Buffer) => {
        if (settled) return;
        responseBuffer += chunk.toString('utf-8');
        if (!responseBuffer.includes('\r\n')) {
          return;
        }

        const statusLine = responseBuffer.split('\r\n')[0] ?? '';
        const match = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})/);
        const statusCode = match ? Number(match[1]) : NaN;

        if (Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 300) {
          settled = true;
          cleanup();
          resolve();
          return;
        }

        fail(`CONNECT rejected by proxy with status line: ${statusLine || 'unknown'}`);
      });

      socket.once('timeout', () => fail(`timeout after ${timeoutMs}ms`));
      socket.once('error', (error) => fail(error instanceof Error ? error.message : String(error)));

      socket.connect(proxyPort, proxyHost);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
