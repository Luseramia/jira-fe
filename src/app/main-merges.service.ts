import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MainMergesPage, MergeListParams } from './models';

// relative path — dev ใช้ proxy.conf.json, prod ให้ nginx proxy /api ไป backend (เหมือน tickets.service.ts)
const API = '/api/main-merges';

@Injectable({ providedIn: 'root' })
export class MainMergesService {
  constructor(private http: HttpClient) {}

  /** 1 หน้าของ 1 กลุ่ม — BE แบ่งหน้าให้ */
  list(p: MergeListParams): Observable<MainMergesPage> {
    let params = new HttpParams().set('days', p.days).set('page', p.page).set('limit', p.limit);
    if (p.group) params = params.set('group', p.group);
    if (p.q) params = params.set('q', p.q);
    if (p.noRef) params = params.set('noRef', 'true');
    if (p.fresh) params = params.set('fresh', 'true');
    return this.http.get<MainMergesPage>(API, { params });
  }
}
