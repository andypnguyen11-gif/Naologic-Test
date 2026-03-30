import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ComponentGapDocument } from '../models/planning.models';

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:5080/api';

  getComponentGaps(partId: string, targetQty: number): Observable<ComponentGapDocument[]> {
    const params = new HttpParams()
      .set('partId', partId)
      .set('targetQty', targetQty);

    return this.http.get<ComponentGapDocument[]>(`${this.apiBaseUrl}/planning/component-gaps`, {
      params
    });
  }
}
