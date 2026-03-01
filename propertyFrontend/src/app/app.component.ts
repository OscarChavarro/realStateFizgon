import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';

type PropertiesCountResponse = {
  count: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private socket: Socket | null = null;

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly lastUpdatedAt = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.refreshCount();
    this.connectUpdatesSocket();
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private connectUpdatesSocket(): void {
    this.socket = io('http://localhost:8081');
    this.socket.on('properties-count-updated', async () => {
      await this.refreshCount();
    });
  }

  private async refreshCount(): Promise<void> {
    const response = await firstValueFrom(
      this.http.get<PropertiesCountResponse>('http://localhost:8081/properties/count')
    );

    this.count.set(response.count);
    this.lastUpdatedAt.set(new Date().toISOString());
    this.loading.set(false);
  }
}
