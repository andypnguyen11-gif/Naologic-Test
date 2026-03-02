import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { CreateWorkOrderRequest, TimelineComponent } from '../timeline/timeline';
import { WorkCenterDocument, WorkOrderDocument } from '../../models/work-orders.models';
import { WorkOrdersService } from '../../services/work-orders.service';
import { WorkOrderPanel, WorkOrderPanelSubmitEvent } from '../panel/work-order-panel/work-order-panel';

@Component({
  selector: 'app-work-orders-page',
  imports: [CommonModule, FormsModule, NgSelectModule, TimelineComponent, WorkOrderPanel],
  templateUrl: './work-orders-page.html',
  styleUrl: './work-orders-page.scss',
  standalone: true
})
export class WorkOrdersPage implements OnInit {
  protected readonly timescales: Timescale[] = ['Day', 'Week', 'Month'];
  protected selectedTimescale: Timescale = 'Day';
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

  constructor(
    private readonly workOrdersService: WorkOrdersService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.workCenters = this.workOrdersService.getWorkCenters();
    this.workOrders = this.workOrdersService.getWorkOrders();
    this.buildTimeline(this.selectedTimescale);
  }

  protected onTimescaleChange(value: Timescale | null): void {
    if (!value) {
      return;
    }
    this.selectedTimescale = value;
    this.buildTimeline(value);
  }

  protected onEditWorkOrder(order: WorkOrderDocument): void {
    this.ngZone.run(() => {
      this.selectedOrder = order;
      this.panelMode = 'edit';
      this.panelSaveError = null;
      this.isPanelOpen = true;
      this.cdr.detectChanges();
    });
  }

  protected onDeleteWorkOrder(order: WorkOrderDocument): void {
    this.workOrders = this.workOrders.filter((item) => item.docId !== order.docId);
    this.workOrdersService.saveWorkOrders(this.workOrders);
    if (this.selectedOrder?.docId === order.docId) {
      this.onClosePanel();
    }
  }

  protected onCreateWorkOrder(request: CreateWorkOrderRequest): void {
    this.ngZone.run(() => {
      this.panelMode = 'create';
      this.selectedOrder = null;
      this.pendingCreateStartDate = request.startDate;
      this.pendingCreateWorkCenterId = request.workCenterId;
      this.panelSaveError = null;
      this.isPanelOpen = true;
      this.cdr.detectChanges();
    });
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
    const nextStart = this.toUtcMillis(event.value.startDate);
    const nextEnd = this.toUtcMillis(event.value.endDate);

    if (Number.isNaN(nextStart) || Number.isNaN(nextEnd) || nextStart > nextEnd) {
      this.panelSaveError = 'End date must be on or after start date.';
      return;
    }

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
      this.workOrdersService.saveWorkOrders(this.workOrders);
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
    this.workOrdersService.saveWorkOrders(this.workOrders);
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
    const { start, end } = this.getWorkOrderDateBounds();
    if (scale === 'Day') {
      this.timelineDates = this.buildDayRange(start, end, 14);
      this.timelineHeader = this.timelineDates.map((date) =>
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      );
      return;
    }

    if (scale === 'Week') {
      this.timelineDates = this.buildWeekRange(start, end, 2);
      this.timelineHeader = this.timelineDates.map((date) =>
        `Wk ${this.getWeekNumber(date)}`
      );
      return;
    }

    this.timelineDates = this.buildMonthRange(start, end, 2);
    this.timelineHeader = this.timelineDates.map((date) =>
      date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    );
  }

  private buildDayRange(start: Date, end: Date, paddingDays: number): Date[] {
    const dates: Date[] = [];
    const first = new Date(start);
    first.setDate(first.getDate() - paddingDays);
    first.setHours(0, 0, 0, 0);

    const last = new Date(end);
    last.setDate(last.getDate() + paddingDays);
    last.setHours(0, 0, 0, 0);

    for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }

  private buildWeekRange(start: Date, end: Date, paddingWeeks: number): Date[] {
    const dates: Date[] = [];
    const first = this.startOfWeek(start);
    first.setDate(first.getDate() - (paddingWeeks * 7));

    const last = this.startOfWeek(end);
    last.setDate(last.getDate() + (paddingWeeks * 7));

    for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 7)) {
      dates.push(new Date(d));
    }
    return dates;
  }

  private buildMonthRange(start: Date, end: Date, paddingMonths: number): Date[] {
    const dates: Date[] = [];
    const first = new Date(start.getFullYear(), start.getMonth() - paddingMonths, 1);
    const last = new Date(end.getFullYear(), end.getMonth() + paddingMonths, 1);

    for (
      const d = new Date(first.getFullYear(), first.getMonth(), 1);
      d <= last;
      d.setMonth(d.getMonth() + 1)
    ) {
      dates.push(new Date(d));
    }
    return dates;
  }

  private getWorkOrderDateBounds(): { start: Date; end: Date } {
    if (!this.workOrders.length) {
      const today = new Date();
      return { start: today, end: today };
    }

    let earliest = this.parseStoredDate(this.workOrders[0].data.startDate);
    let latest = this.parseStoredDate(this.workOrders[0].data.endDate);

    for (const order of this.workOrders) {
      const orderStart = this.parseStoredDate(order.data.startDate);
      const orderEnd = this.parseStoredDate(order.data.endDate);
      if (orderStart < earliest) {
        earliest = orderStart;
      }
      if (orderEnd > latest) {
        latest = orderEnd;
      }
    }

    return { start: earliest, end: latest };
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

  private parseStoredDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }
}

type Timescale = 'Day' | 'Week' | 'Month';
