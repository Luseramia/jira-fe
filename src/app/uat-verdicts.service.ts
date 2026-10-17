import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UatVerdict, UatVerdictList } from './models';

// relative path — dev ใช้ proxy.conf.json, prod ให้ nginx proxy /api ไป backend (เหมือน tickets.service.ts)
const API = '/api/uat-verdicts';

@Injectable({ providedIn: 'root' })
export class UatVerdictsService {
  constructor(private http: HttpClient) {}

  list(): Observable<UatVerdictList> {
    return this.http.get<UatVerdictList>(API);
  }

  process(): Observable<unknown> {
    return this.http.post(`${API}/process`, {});
  }

  approve(id: number): Observable<UatVerdict> {
    return this.http.post<UatVerdict>(`${API}/${id}/approve`, {});
  }

  dismiss(id: number): Observable<UatVerdict> {
    return this.http.post<UatVerdict>(`${API}/${id}/dismiss`, {});
  }

  requeue(id: number, jiraKey?: string): Observable<UatVerdict> {
    return this.http.post<UatVerdict>(`${API}/${id}/requeue`, jiraKey ? { jiraKey } : {});
  }
}
