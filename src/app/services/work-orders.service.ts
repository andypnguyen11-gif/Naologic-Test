import { Injectable } from '@angular/core';
import { WorkCenterDocument, WorkOrderDocument } from '../models/work-orders.models';

@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  private readonly workCenters: WorkCenterDocument[] = [
    { docId: 'wc-001', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
    { docId: 'wc-002', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
    { docId: 'wc-003', docType: 'workCenter', data: { name: 'Assembly Station' } },
    { docId: 'wc-004', docType: 'workCenter', data: { name: 'Quality Control' } },
    { docId: 'wc-005', docType: 'workCenter', data: { name: 'Packaging Line' } }
  ];

  private readonly workOrders: WorkOrderDocument[] = [
    {
      docId: 'wo-001',
      docType: 'workOrder',
      data: {
        name: 'Extrude 6mm Sheet',
        workCenterId: 'wc-001',
        status: 'complete',
        startDate: '2026-02-14',
        endDate: '2026-02-18'
      }
    },
    {
      docId: 'wo-002',
      docType: 'workOrder',
      data: {
        name: 'Extrude 12mm Sheet',
        workCenterId: 'wc-001',
        status: 'in-progress',
        startDate: '2026-02-20',
        endDate: '2026-02-27'
      }
    },
    {
      docId: 'wo-003',
      docType: 'workOrder',
      data: {
        name: 'CNC Bracket Run',
        workCenterId: 'wc-002',
        status: 'open',
        startDate: '2026-02-26',
        endDate: '2026-03-02'
      }
    },
    {
      docId: 'wo-004',
      docType: 'workOrder',
      data: {
        name: 'CNC Housing Batch',
        workCenterId: 'wc-002',
        status: 'blocked',
        startDate: '2026-03-04',
        endDate: '2026-03-08'
      }
    },
    {
      docId: 'wo-005',
      docType: 'workOrder',
      data: {
        name: 'Final Assembly A',
        workCenterId: 'wc-003',
        status: 'open',
        startDate: '2026-02-22',
        endDate: '2026-02-28'
      }
    },
    {
      docId: 'wo-006',
      docType: 'workOrder',
      data: {
        name: 'QC Incoming Lot',
        workCenterId: 'wc-004',
        status: 'in-progress',
        startDate: '2026-02-24',
        endDate: '2026-02-26'
      }
    },
    {
      docId: 'wo-007',
      docType: 'workOrder',
      data: {
        name: 'QC Final Inspection',
        workCenterId: 'wc-004',
        status: 'blocked',
        startDate: '2026-02-28',
        endDate: '2026-03-05'
      }
    },
    {
      docId: 'wo-008',
      docType: 'workOrder',
      data: {
        name: 'Pack Batch 71',
        workCenterId: 'wc-005',
        status: 'complete',
        startDate: '2026-02-16',
        endDate: '2026-02-19'
      }
    }
  ];

  getWorkCenters(): WorkCenterDocument[] {
    return [...this.workCenters];
  }

  getWorkOrders(): WorkOrderDocument[] {
    return [...this.workOrders];
  }
}
