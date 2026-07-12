import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Overview,
  TicketDetail,
  TicketFilters,
  TicketListResponse,
  TicketQuery,
  WorkloadGroup,
} from './models';

// ปรับ URL ตรงนี้ถ้า deploy แยกโดเมน (เหมือน issues.service.ts)
const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  constructor(private http: HttpClient) {}

  list(query: TicketQuery): Observable<TicketListResponse> {
    let params = new HttpParams();
    const q = query as Record<string, unknown>;
    for (const key of Object.keys(q)) {
      const v = q[key];
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(key, String(v));
      }
    }
    return this.http.get<TicketListResponse>(`${API}/tickets`, { params });
  }

  filters(): Observable<TicketFilters> {
    return this.http.get<TicketFilters>(`${API}/tickets/filters`);
  }

  detail(ticketNumber: string): Observable<TicketDetail> {
    return this.http.get<TicketDetail>(`${API}/tickets/${encodeURIComponent(ticketNumber)}`);
  }

  addLink(ticketNumber: string, jiraKey: string): Observable<unknown> {
    return this.http.post(`${API}/tickets/${encodeURIComponent(ticketNumber)}/link`, { jiraKey });
  }

  removeLink(ticketNumber: string, jiraKey: string): Observable<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(
      `${API}/tickets/${encodeURIComponent(ticketNumber)}/link/${encodeURIComponent(jiraKey)}`,
    );
  }

  workload(opts: { includeDone?: boolean; department?: string; requester?: string } = {}): Observable<WorkloadGroup[]> {
    let params = new HttpParams();
    if (opts.includeDone) params = params.set('includeDone', 'true');
    if (opts.department) params = params.set('department', opts.department);
    if (opts.requester) params = params.set('requester', opts.requester);
    return this.http.get<WorkloadGroup[]>(`${API}/jira/workload`, { params });
  }

  /** URL สำหรับดาวน์โหลด CSV ตาม filter ปัจจุบัน (browser โหลดตรง) */
  exportUrl(query: TicketQuery): string {
    let params = new HttpParams();
    const q = query as Record<string, unknown>;
    for (const key of ['department', 'requester', 'finalStatus', 'sheetStatus', 'hasJira', 'mismatch', 'year', 'q']) {
      const v = q[key];
      if (v !== undefined && v !== null && v !== '') params = params.set(key, String(v));
    }
    const qs = params.toString();
    return `${API}/tickets/export${qs ? '?' + qs : ''}`;
  }

  overview(year?: number): Observable<Overview> {
    let params = new HttpParams();
    if (year != null) params = params.set('year', String(year));
    return this.http.get<Overview>(`${API}/overview`, { params });
  }
}
