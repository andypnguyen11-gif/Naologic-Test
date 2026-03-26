import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom } from 'rxjs';
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
  protected isLoading = true;
  protected panelMode: 'create' | 'edit' = 'create';
  protected selectedOrder: WorkOrderDocument | null = null;
  protected pendingCreateStartDate: string | null = null;
  protected pendingCreateWorkCenterId: string | null = null;
  protected loadError: string | null = null;
  protected panelSaveError: string | null = null;
  @ViewChild(TimelineComponent) private timeline?: TimelineComponent;

  protected get canScrollToToday(): boolean {
    return this.timeline?.hasCurrentPeriod ?? false;
  }

  constructor(
    private readonly workOrdersService: WorkOrdersService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadPageData();
  }

  protected onTimescaleChange(value: Timescale | null): void {
    if (!value) {
      return;
    }
    this.selectedTimescale = value;
    this.buildTimeline(value);
  }

  protected onTodayClick(): void {
    this.timeline?.scrollToToday();
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

  protected async onDeleteWorkOrder(order: WorkOrderDocument): Promise<void> {
    try {
      await firstValueFrom(this.workOrdersService.deleteWorkOrder(order.docId));
      this.workOrders = this.workOrders.filter((item) => item.docId !== order.docId);
      if (this.selectedOrder?.docId === order.docId) {
        this.onClosePanel();
      }
      this.buildTimeline(this.selectedTimescale);
      this.loadError = null;
    } catch {
      this.loadError = 'Unable to delete the work order. Check that the API is running.';
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

  protected async onSaveOrder(event: WorkOrderPanelSubmitEvent): Promise<void> {
    const targetWorkCenterId =
      event.mode === 'edit'
        ? (this.selectedOrder?.data.workCenterId ?? '')
        : (this.pendingCreateWorkCenterId ?? this.workCenters[0]?.docId ?? '');
    const excludeOrderId = event.mode === 'edit' ? event.orderId : null;
    const nextStart = this.toUtcMillis(event.value.startDate);
    const nextEnd = this.toUtcMillis(event.value.endDate);

    // Keep a second guard here even though the panel validates dates, so invalid
    // values cannot be persisted through any future UI or programmatic path.
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
      const existingOrder = this.workOrders.find((order) => order.docId === event.orderId);
      if (!existingOrder) {
        this.panelSaveError = 'The selected work order no longer exists.';
        return;
      }

      try {
        const updatedOrder = await firstValueFrom(this.workOrdersService.updateWorkOrder({
          ...existingOrder,
          data: {
            ...existingOrder.data,
            name: event.value.name,
            workCenterId: targetWorkCenterId,
            status: event.value.status,
            startDate: event.value.startDate,
            endDate: event.value.endDate
          }
        }));
        this.workOrders = this.workOrders.map((order) =>
          order.docId === event.orderId ? updatedOrder : order
        );
        this.buildTimeline(this.selectedTimescale);
        this.onClosePanel();
      } catch {
        this.panelSaveError = 'Unable to save the work order. Check that the API is running.';
      }
      return;
    }

    try {
      const createdOrder = await firstValueFrom(this.workOrdersService.createWorkOrder({
        data: {
          name: event.value.name,
          workCenterId: targetWorkCenterId,
          status: event.value.status,
          startDate: event.value.startDate,
          endDate: event.value.endDate
        }
      }));
      this.workOrders = [...this.workOrders, createdOrder];
      this.buildTimeline(this.selectedTimescale);
      this.onClosePanel();
    } catch {
      this.panelSaveError = 'Unable to create the work order. Check that the API is running.';
    }
  }

  private async loadPageData(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;

    try {
      const [workCenters, workOrders] = await Promise.all([
        firstValueFrom(this.workOrdersService.getWorkCenters()),
        firstValueFrom(this.workOrdersService.getWorkOrders())
      ]);
      this.workCenters = workCenters;
      this.workOrders = workOrders;
      this.buildTimeline(this.selectedTimescale);
    } catch {
      this.loadError = 'Unable to load work orders. Start the API and verify the database connection.';
    } finally {
      this.isLoading = false;
    }
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
      // Inclusive comparison prevents back-dated collisions inside the same work center.
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

    // Build the rendered range from the actual work-order bounds so users can
    // scroll to the earliest and latest scheduled items in the sample data.
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
    // Use local calendar parsing instead of Date(string) to avoid timezone drift.
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }
}

type Timescale = 'Day' | 'Week' | 'Month';
