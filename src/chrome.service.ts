import { Injectable, OnModuleInit } from '@nestjs/common';
import { spawn, ChildProcess } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import CDP = require('chrome-remote-interface');
import { Configuration } from './config/configuration';

@Injectable()
export class ChromeService implements OnModuleInit {
  private chromeProcess?: ChildProcess;
  private chromeStdoutFd?: number;
  private chromeStderrFd?: number;
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;

  constructor(private readonly configuration: Configuration) {}

  async onModuleInit(): Promise<void> {
    await this.launchChrome();
    await this.openHomePage();
  }

  private async launchChrome(): Promise<void> {
    const logsDir = join(process.cwd(), 'output', 'logs');
    mkdirSync(logsDir, { recursive: true });
    this.chromeStdoutFd = openSync(join(logsDir, 'chrome_stdout.log'), 'a');
    this.chromeStderrFd = openSync(join(logsDir, 'chrome_stderr.log'), 'a');

    this.chromeProcess = spawn(this.configuration.chromeBinary, [
      `--remote-debugging-port=${this.cdpPort}`,
      `--user-data-dir=${this.configuration.chromePath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      'about:blank'
    ], {
      stdio: ['ignore', this.chromeStdoutFd, this.chromeStderrFd]
    });

    this.chromeProcess.once('exit', () => {
      if (this.chromeStdoutFd !== undefined) {
        closeSync(this.chromeStdoutFd);
        this.chromeStdoutFd = undefined;
      }
      if (this.chromeStderrFd !== undefined) {
        closeSync(this.chromeStderrFd);
        this.chromeStderrFd = undefined;
      }
    });

    await this.waitForCdp();
  }

  private async waitForCdp(): Promise<void> {
    const timeout = 60000;
    const start = Date.now();
    let lastError: unknown;

    while (Date.now() - start < timeout) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(`http://${this.cdpHost}:${this.cdpPort}/json/version`, {
          signal: controller.signal
        });
        if (response.ok) {
          return;
        }
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(
      `CDP endpoint did not become available in time at ${this.cdpHost}:${this.cdpPort}${lastError ? ` (${String(lastError)})` : ''}`
    );
  }

  private async openHomePage(): Promise<void> {
    const targets = await CDP.List({ host: this.cdpHost, port: this.cdpPort });
    const pageTarget = targets.find((target: { type?: string }) => target.type === 'page');

    if (!pageTarget) {
      throw new Error('No page target available in Chrome');
    }

    const client = await CDP({ host: this.cdpHost, port: this.cdpPort, target: pageTarget });

    try {
      const { Page } = client;
      await Page.enable();
      await Page.navigate({ url: this.configuration.scraperHomeUrl });
      await new Promise<void>((resolve) => {
        Page.loadEventFired(() => resolve());
      });
    } finally {
      await client.close();
    }
  }
}
