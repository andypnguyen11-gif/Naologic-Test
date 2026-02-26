import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CreateWorkOrderRequest, TimelineComponent } from '../timeline/timeline';
import { WorkCenterDocument, WorkOrderDocument } from '../../models/work-orders.models';
import { WorkOrdersService } from '../../services/work-orders.service';
import { WorkOrderPanel, WorkOrderPanelSubmitEvent } from '../panel/work-order-panel/work-order-panel';

@Component({
  selector: 'app-work-orders-page',
  imports: [CommonModule, TimelineComponent, WorkOrderPanel],
  templateUrl: './work-orders-page.html',
  styleUrl: './work-orders-page.scss',
  standalone: true
})
export class WorkOrdersPage implements OnInit {
  protected readonly timescales: Timescale[] = ['Hour', 'Day', 'Week', 'Month'];
  protected selectedTimescale: Timescale = 'Month';
  protected workCenters: WorkCenterDocument[] = [];
  protected workOrders: WorkOrderDocument[] = [];
  protected timelineHeader: string[] = [];
  protected timelineDates: Date[] = [];
  protected isPanelOpen = false;
  protected panelMode: 'create' | 'edit' = 'create';
  protected selectedOrder: WorkOrderDocument | null = null;
  protected pendingCreateStartDate: string | null = null;
  protected pendingCreateWorkCenterId: string | null = null;
  protected panelSaveError: string | null = null;

  constructor(private readonly workOrdersService: WorkOrdersService) {}

  ngOnInit(): void {
    this.workCenters = this.workOrdersService.getWorkCenters();
    this.workOrders = this.workOrdersService.getWorkOrders();
    this.buildTimeline(this.selectedTimescale);
  }

  protected onTimescaleChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    const value = target.value as Timescale;
    this.selectedTimescale = value;
    this.buildTimeline(value);
  }

  protected onEditWorkOrder(order: WorkOrderDocument): void {
    this.selectedOrder = order;
    this.panelMode = 'edit';
    this.panelSaveError = null;
    this.isPanelOpen = true;
  }

  protected onDeleteWorkOrder(order: WorkOrderDocument): void {
    this.workOrders = this.workOrders.filter((item) => item.docId !== order.docId);
    if (this.selectedOrder?.docId === order.docId) {
      this.onClosePanel();
    }
  }

  protected onCreateWorkOrder(request: CreateWorkOrderRequest): void {
    this.panelMode = 'create';
    this.selectedOrder = null;
    this.pendingCreateStartDate = request.startDate;
    this.pendingCreateWorkCenterId = request.workCenterId;
    this.panelSaveError = null;
    this.isPanelOpen = true;
  }

  protected onClosePanel(): void {
    this.isPanelOpen = false;
    this.selectedOrder = null;
    this.pendingCreateStartDate = null;
    this.pendingCreateWorkCenterId = null;
    this.panelSaveError = null;
  }

  protected onSaveOrder(event: WorkOrderPanelSubmitEvent): void {
    const targetWorkCenterId =
      event.mode === 'edit'
        ? (this.selectedOrder?.data.workCenterId ?? '')
        : (this.pendingCreateWorkCenterId ?? this.workCenters[0]?.docId ?? '');
    const excludeOrderId = event.mode === 'edit' ? event.orderId : null;

    if (this.hasOverlap(targetWorkCenterId, event.value.startDate, event.value.endDate, excludeOrderId)) {
      this.panelSaveError = 'Dates overlap an existing work order on this work center.';
      return;
    }
    this.panelSaveError = null;

    if (event.mode === 'edit' && event.orderId) {
      this.workOrders = this.workOrders.map((order) => {
        if (order.docId !== event.orderId) {
          return order;
        }
        return {
          ...order,
          data: {
            ...order.data,
            name: event.value.name,
            status: event.value.status,
            startDate: event.value.startDate,
            endDate: event.value.endDate
          }
        };
      });
      this.onClosePanel();
      return;
    }

    const fallbackWorkCenterId = targetWorkCenterId;
    const createdOrder: WorkOrderDocument = {
      docId: `wo-${Date.now()}`,
      docType: 'workOrder',
      data: {
        name: event.value.name,
        workCenterId: fallbackWorkCenterId,
        status: event.value.status,
        startDate: event.value.startDate,
        endDate: event.value.endDate
      }
    };
    this.workOrders = [...this.workOrders, createdOrder];
    this.onClosePanel();
  }

  private hasOverlap(
    workCenterId: string,
    startDate: string,
    endDate: string,
    excludeOrderId: string | null
  ): boolean {
    const nextStart = this.toUtcMillis(startDate);
    const nextEnd = this.toUtcMillis(endDate);
    if (Number.isNaN(nextStart) || Number.isNaN(nextEnd)) {
      return false;
    }

    return this.workOrders.some((order) => {
      if (order.data.workCenterId !== workCenterId) {
        return false;
      }
      if (excludeOrderId && order.docId === excludeOrderId) {
        return false;
      }
      const existingStart = this.toUtcMillis(order.data.startDate);
      const existingEnd = this.toUtcMillis(order.data.endDate);
      return nextStart <= existingEnd && nextEnd >= existingStart;
    });
  }

  private toUtcMillis(dateString: string): number {
    return new Date(`${dateString}T00:00:00Z`).getTime();
  }

  private buildTimeline(scale: Timescale): void {
    const today = new Date();
    if (scale === 'Hour') {
      this.timelineDates = this.buildHourRange(today, 12);
      this.timelineHeader = this.timelineDates.map((date) =>
        date.toLocaleTimeString('en-US', { hour: 'numeric' })
      );
      return;
    }

    if (scale === 'Day') {
      this.timelineDates = this.buildDayRange(today, 14);
      this.timelineHeader = this.timelineDates.map((date) =>
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      );
      return;
    }

    if (scale === 'Week') {
      this.timelineDates = this.buildWeekRange(today, 6);
      this.timelineHeader = this.timelineDates.map((date) =>
        `Wk ${this.getWeekNumber(date)}`
      );
      return;
    }

    this.timelineDates = this.buildMonthRange(today, 6);
    this.timelineHeader = this.timelineDates.map((date) =>
      date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    );
  }

  private buildDayRange(center: Date, daysAround: number): Date[] {
    const dates: Date[] = [];
    for (let offset = -daysAround; offset <= daysAround; offset += 1) {
      const d = new Date(center);
      d.setDate(d.getDate() + offset);
      dates.push(d);
    }
    return dates;
  }

  private buildHourRange(center: Date, hoursAround: number): Date[] {
    const dates: Date[] = [];
    for (let offset = -hoursAround; offset <= hoursAround; offset += 1) {
      const d = new Date(center);
      d.setHours(d.getHours() + offset, 0, 0, 0);
      dates.push(d);
    }
    return dates;
  }

  private buildWeekRange(center: Date, weeksAround: number): Date[] {
    const start = this.startOfWeek(center);
    const dates: Date[] = [];
    for (let offset = -weeksAround; offset <= weeksAround; offset += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + offset * 7);
      dates.push(d);
    }
    return dates;
  }

  private buildMonthRange(center: Date, monthsAround: number): Date[] {
    const dates: Date[] = [];
    for (let offset = -monthsAround; offset <= monthsAround; offset += 1) {
      const d = new Date(center.getFullYear(), center.getMonth() + offset, 1);
      dates.push(d);
    }
    return dates;
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month';
