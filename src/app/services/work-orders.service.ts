import { Injectable } from '@angular/core';
import { WorkCenterDocument, WorkOrderDocument } from '../models/work-orders.models';

@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  private readonly storageKey = 'naologic.work-orders';
  private readonly workCenters: WorkCenterDocument[] = [
    { docId: 'wc-001', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
    { docId: 'wc-002', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
    { docId: 'wc-003', docType: 'workCenter', data: { name: 'Assembly Station' } },
    { docId: 'wc-004', docType: 'workCenter', data: { name: 'Quality Control' } },
    { docId: 'wc-005', docType: 'workCenter', data: { name: 'Packaging Line' } }
  ];

  private readonly defaultWorkOrders: WorkOrderDocument[] = [
    {
      docId: 'wo-001',
      docType: 'workOrder',
      data: {
        name: 'Extrude 6mm Sheet',
        workCenterId: 'wc-001',
        status: 'complete',
        startDate: '2025-08-05',
        endDate: '2025-10-18'
      }
    },
    {
      docId: 'wo-002',
      docType: 'workOrder',
      data: {
        name: 'Extrude 12mm Sheet',
        workCenterId: 'wc-001',
        status: 'in-progress',
        startDate: '2025-11-02',
        endDate: '2026-01-24'
      }
    },
    {
      docId: 'wo-003',
      docType: 'workOrder',
      data: {
        name: 'CNC Bracket Run',
        workCenterId: 'wc-002',
        status: 'open',
        startDate: '2026-01-06',
        endDate: '2026-02-22'
      }
    },
    {
      docId: 'wo-004',
      docType: 'workOrder',
      data: {
        name: 'CNC Housing Batch',
        workCenterId: 'wc-002',
        status: 'blocked',
        startDate: '2026-03-03',
        endDate: '2026-04-28'
      }
    },
    {
      docId: 'wo-005',
      docType: 'workOrder',
      data: {
        name: 'Final Assembly A',
        workCenterId: 'wc-003',
        status: 'open',
        startDate: '2025-12-10',
        endDate: '2026-02-05'
      }
    },
    {
      docId: 'wo-006',
      docType: 'workOrder',
      data: {
        name: 'QC Incoming Lot',
        workCenterId: 'wc-004',
        status: 'in-progress',
        startDate: '2025-11-20',
        endDate: '2026-01-12'
      }
    },
    {
      docId: 'wo-007',
      docType: 'workOrder',
      data: {
        name: 'QC Final Inspection',
        workCenterId: 'wc-004',
        status: 'blocked',
        startDate: '2026-02-03',
        endDate: '2026-03-18'
      }
    },
    {
      docId: 'wo-008',
      docType: 'workOrder',
      data: {
        name: 'Pack Batch 71',
        workCenterId: 'wc-005',
        status: 'complete',
        startDate: '2025-09-14',
        endDate: '2025-11-08'
      }
    }
  ];

  getWorkCenters(): WorkCenterDocument[] {
    return [...this.workCenters];
  }

  getWorkOrders(): WorkOrderDocument[] {
    return [...this.readWorkOrders()];
  }

  saveWorkOrders(workOrders: WorkOrderDocument[]): void {
    this.writeWorkOrders(workOrders);
  }

  private readWorkOrders(): WorkOrderDocument[] {
    const storage = this.getStorage();
    if (!storage) {
      return [...this.defaultWorkOrders];
    }

    const raw = storage.getItem(this.storageKey);
    if (!raw) {
      return [...this.defaultWorkOrders];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [...this.defaultWorkOrders];
      }
      return parsed as WorkOrderDocument[];
    } catch {
      return [...this.defaultWorkOrders];
    }
  }

  private writeWorkOrders(workOrders: WorkOrderDocument[]): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    storage.setItem(this.storageKey, JSON.stringify(workOrders));
  }

  private getStorage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }
}
