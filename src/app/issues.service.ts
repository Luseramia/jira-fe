import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Comment, Issue, Summary, WeeklyReport } from './models';

// relative path — dev ใช้ proxy.conf.json, prod ให้ nginx proxy /api ไป backend
const API = '/api';

@Injectable({ providedIn: 'root' })
export class IssuesService {
  constructor(private http: HttpClient) {}

  list(project?: string): Observable<Issue[]> {
    const q = project ? `?project=${encodeURIComponent(project)}` : '';
    return this.http.get<Issue[]>(`${API}/issues${q}`);
  }

  summary(project?: string): Observable<Summary> {
    const q = project ? `?project=${encodeURIComponent(project)}` : '';
    return this.http.get<Summary>(`${API}/issues/summary${q}`);
  }

  comments(key: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${API}/issues/${encodeURIComponent(key)}/comments`);
  }

  weeklyReport(project?: string): Observable<WeeklyReport> {
    const q = project ? `?project=${encodeURIComponent(project)}` : '';
    return this.http.get<WeeklyReport>(`${API}/weekly-report${q}`);
  }
}
