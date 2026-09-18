import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/environment';

interface LeadSummary {
  id: string;
  name: string;
  email: string;
  status: string;
  leadScore: number;
  source: string;
}

interface Insights {
  total: number;
  countsByStatus: Record<string, number>;
  topLeads: LeadSummary[];
}

@Component({
  selector: 'app-lead-insights',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-insights.component.html',
})
export class LeadInsightsComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private socket: Socket | null = null;

  readonly insights = signal<Insights | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly liveNotice = signal('');
  readonly statuses = ['new', 'contacted', 'qualified', 'won', 'lost'];

  email = 'admin@leadflow.local';
  password = 'admin123';
  token = sessionStorage.getItem('leadflow_insights_token') || '';

  constructor() {
    if (this.token) {
      this.loadInsights();
      this.connectSocket();
    }
  }

  ngOnDestroy(): void {
    this.disconnectSocket();
  }

  login(): void {
    this.loading.set(true);
    this.error.set('');
    this.http
      .post<{ token: string }>(`${environment.apiUrl}/api/auth/login`, {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: ({ token }) => {
          this.token = token;
          sessionStorage.setItem('leadflow_insights_token', token);
          this.loadInsights();
          this.connectSocket();
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(error.error?.error || 'Could not sign in');
        },
      });
  }

  loadInsights(): void {
    this.loading.set(true);
    this.error.set('');
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.token}` });
    this.http
      .get<Insights>(`${environment.apiUrl}/api/analytics/insights`, { headers })
      .subscribe({
        next: (data) => {
          this.insights.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(error.error?.error || 'Could not load lead insights');
          if (error.status === 401) this.logout();
        },
      });
  }

  logout(): void {
    sessionStorage.removeItem('leadflow_insights_token');
    this.token = '';
    this.insights.set(null);
    this.disconnectSocket();
  }

  private connectSocket(): void {
    if (this.socket) return;
    this.socket = io(environment.apiUrl, { reconnectionAttempts: Infinity });
    this.socket.on('lead:created', (lead: LeadSummary) => {
      this.liveNotice.set(`🔴 Live: New lead "${lead.name}" received!`);
      this.loadInsights();
    });
  }

  private disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

