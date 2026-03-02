import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { WorkCenterDocument, WorkOrderDocument } from '../../models/work-orders.models';

export interface CreateWorkOrderRequest {
  workCenterId: string;
  startDate: string;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss'
})
export class TimelineComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) timescaleLabel: Timescale = 'Month';
  @Input({ required: true }) workCenters: WorkCenterDocument[] = [];
  @Input({ required: true }) timelineHeader: string[] = [];
  @Input({ required: true }) timelineDates: Date[] = [];
  @Input({ required: true }) workOrders: WorkOrderDocument[] = [];
  @Output() editWorkOrder = new EventEmitter<WorkOrderDocument>();
  @Output() deleteWorkOrder = new EventEmitter<WorkOrderDocument>();
  @Output() createWorkOrder = new EventEmitter<CreateWorkOrderRequest>();
  @ViewChild('timelineScroller') private timelineScroller?: ElementRef<HTMLDivElement>;
  @ViewChild('currentPeriodMarker') private currentPeriodMarker?: ElementRef<HTMLDivElement>;

  private indexMap = new Map<string, number>();
  protected readonly actionOptions: ActionOption[] = [
    { label: 'Edit', value: 'edit' },
    { label: 'Delete', value: 'delete' }
  ];
  private selectedActionByOrderId: Record<string, ActionValue | null> = {};
  protected openedActionOrderId: string | null = null;
  protected openedActionWorkCenterId: string | null = null;
  protected hoveredWorkCenterId: string | null = null;
  protected hoveredTimelineCellWorkCenterId: string | null = null;
  protected hoveredTimelineCellGridColumn: string | null = null;

  ngAfterViewInit(): void {
    this.scheduleScrollToCurrentPeriod();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['timelineDates'] || changes['timescaleLabel']) {
      this.rebuildIndexMap();
      this.scheduleScrollToCurrentPeriod();
    }
  }

  get gridTemplateColumns(): string {
    return `repeat(${this.timelineHeader.length}, minmax(120px, 1fr))`;
  }

  get hasCurrentPeriod(): boolean {
    return this.currentPeriodIndex !== null;
  }

  get currentPeriodIndex(): number | null {
    return this.getIndexForDate(new Date());
  }

  get currentPeriodGridColumn(): string | null {
    return this.currentPeriodIndex !== null ? `${this.currentPeriodIndex + 1}` : null;
  }

  getWorkOrdersForCenter(centerId: string): WorkOrderDocument[] {
    return this.workOrders.filter((order) => {
      if (order.data.workCenterId !== centerId) {
        return false;
      }
      return this.getVisibleRangeForOrder(order) !== null;
    });
  }

  getGridColumn(order: WorkOrderDocument): string | null {
    const visibleRange = this.getVisibleRangeForOrder(order);
    if (!visibleRange) {
      return null;
    }
    const safeEnd = Math.max(visibleRange.start, visibleRange.end);
    return `${visibleRange.start + 1} / ${safeEnd + 2}`;
  }

  getBarStartInsetPercent(order: WorkOrderDocument): number {
    const visibleRange = this.getVisibleRangeForOrder(order);
    if (!visibleRange) {
      return 0;
    }
    const span = Math.max(1, visibleRange.end - visibleRange.start + 1);
    return (visibleRange.startOffset / span) * 100;
  }

  getBarEndInsetPercent(order: WorkOrderDocument): number {
    const visibleRange = this.getVisibleRangeForOrder(order);
    if (!visibleRange) {
      return 0;
    }
    const span = Math.max(1, visibleRange.end - visibleRange.start + 1);
    return ((1 - visibleRange.endOffset) / span) * 100;
  }

  onEditClick(order: WorkOrderDocument): void {
    this.editWorkOrder.emit(order);
  }

  onDeleteClick(order: WorkOrderDocument): void {
    this.deleteWorkOrder.emit(order);
  }

  onActionChange(order: WorkOrderDocument, selection: ActionSelection | null): void {
    const action = this.resolveAction(selection);
    if (!action) {
      return;
    }
    this.selectedActionByOrderId[order.docId] = action;

    if (action === 'edit') {
      this.onEditClick(order);
    } else {
      this.onDeleteClick(order);
    }

    setTimeout(() => {
      this.selectedActionByOrderId[order.docId] = null;
    }, 0);
    this.openedActionOrderId = null;
    this.openedActionWorkCenterId = null;
  }

  onTimelineCellClick(workCenterId: string, date: Date, event: MouseEvent): void {
    event.stopPropagation();
    this.createWorkOrder.emit({
      workCenterId,
      startDate: this.formatDate(date)
    });
  }

  onTimelineCellHover(workCenterId: string, date: Date | null): void {
    if (!date) {
      this.hoveredTimelineCellWorkCenterId = null;
      this.hoveredTimelineCellGridColumn = null;
      return;
    }

    const index = this.getIndexForDate(date);
    this.hoveredTimelineCellWorkCenterId = workCenterId;
    this.hoveredTimelineCellGridColumn = index !== null ? `${index + 1}` : null;
  }

  getSelectedAction(orderId: string): ActionValue | null {
    return this.selectedActionByOrderId[orderId] ?? null;
  }

  onActionOpen(orderId: string, workCenterId: string): void {
    this.selectedActionByOrderId[orderId] = null;
    this.openedActionOrderId = orderId;
    this.openedActionWorkCenterId = workCenterId;
  }

  onActionClose(orderId: string, workCenterId: string): void {
    this.selectedActionByOrderId[orderId] = null;
    if (this.openedActionOrderId === orderId) {
      this.openedActionOrderId = null;
    }
    if (this.openedActionWorkCenterId === workCenterId) {
      this.openedActionWorkCenterId = null;
    }
  }

  isActionRowOpen(workCenterId: string): boolean {
    return this.openedActionWorkCenterId === workCenterId;
  }

  onRowHover(workCenterId: string | null): void {
    this.hoveredWorkCenterId = workCenterId;
  }

  isRowHovered(workCenterId: string): boolean {
    return this.hoveredWorkCenterId === workCenterId;
  }

  private rebuildIndexMap(): void {
    this.indexMap = new Map(
      this.timelineDates.map((date, index) => [this.unitKey(date), index])
    );
  }

  private getIndexForDate(date: Date): number | null {
    const key = this.unitKey(date);
    return this.indexMap.has(key) ? this.indexMap.get(key)! : null;
  }

  private getVisibleRangeForOrder(order: WorkOrderDocument): VisibleRange | null {
    if (!this.timelineDates.length) {
      return null;
    }

    const firstVisible = this.timelineDates[0];
    const lastVisible = this.timelineDates[this.timelineDates.length - 1];
    const orderStart = this.parseStoredDate(order.data.startDate);
    const orderEnd = this.parseStoredDate(order.data.endDate);

    const normalizedVisibleStart = this.normalizeForTimescale(firstVisible);
    const normalizedVisibleEnd = this.normalizeForTimescale(lastVisible);
    const normalizedOrderStart = this.normalizeForTimescale(orderStart);
    const normalizedOrderEnd = this.normalizeForTimescale(orderEnd);

    if (normalizedOrderEnd < normalizedVisibleStart || normalizedOrderStart > normalizedVisibleEnd) {
      return null;
    }

    const clippedStart = normalizedOrderStart < normalizedVisibleStart
      ? normalizedVisibleStart
      : normalizedOrderStart;
    const clippedEnd = normalizedOrderEnd > normalizedVisibleEnd
      ? normalizedVisibleEnd
      : normalizedOrderEnd;

    const start = this.getIndexForDate(clippedStart);
    const end = this.getIndexForDate(clippedEnd);
    if (start === null || end === null) {
      return null;
    }

    return {
      start,
      end,
      startOffset: normalizedOrderStart < normalizedVisibleStart
        ? 0
        : this.getPositionWithinUnit(orderStart),
      endOffset: normalizedOrderEnd > normalizedVisibleEnd
        ? 1
        : this.getPositionWithinUnit(orderEnd)
    };
  }

  private unitKey(date: Date): string {
    const d = this.normalizeForTimescale(date);
    return d.toISOString();
  }

  private normalizeForTimescale(date: Date): Date {
    const d = new Date(date);
    if (this.timescaleLabel === 'Day') {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (this.timescaleLabel === 'Week') {
      const day = d.getDay();
      const diff = (day + 6) % 7;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getPositionWithinUnit(date: Date): number {
    if (this.timescaleLabel === 'Day') {
      return 0;
    }

    if (this.timescaleLabel === 'Week') {
      const day = (date.getDay() + 6) % 7;
      return day / 6;
    }

    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    if (daysInMonth <= 1) {
      return 0;
    }
    return (date.getDate() - 1) / (daysInMonth - 1);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseStoredDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  private resolveAction(selection: ActionSelection | null): ActionValue | null {
    if (!selection) {
      return null;
    }
    if (typeof selection === 'string') {
      return selection;
    }
    return selection.value;
  }

  private scheduleScrollToCurrentPeriod(): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => this.scrollToCurrentPeriod());
    });
  }

  private scrollToCurrentPeriod(): void {
    const scroller = this.timelineScroller?.nativeElement;
    const marker = this.currentPeriodMarker?.nativeElement;
    if (!scroller || !marker) {
      return;
    }

    const targetLeft = marker.offsetLeft - (scroller.clientWidth / 2) + (marker.offsetWidth / 2);
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.min(Math.max(0, targetLeft), maxScrollLeft);
  }
}

type Timescale = 'Day' | 'Week' | 'Month';
type ActionValue = 'edit' | 'delete';
type ActionSelection = ActionValue | ActionOption;

interface ActionOption {
  label: string;
  value: ActionValue;
}

interface VisibleRange {
  start: number;
  end: number;
  startOffset: number;
  endOffset: number;
}
