import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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
export class TimelineComponent implements OnChanges {
  @Input({ required: true }) timescaleLabel: Timescale = 'Month';
  @Input({ required: true }) workCenters: WorkCenterDocument[] = [];
  @Input({ required: true }) timelineHeader: string[] = [];
  @Input({ required: true }) timelineDates: Date[] = [];
  @Input({ required: true }) workOrders: WorkOrderDocument[] = [];
  @Output() editWorkOrder = new EventEmitter<WorkOrderDocument>();
  @Output() deleteWorkOrder = new EventEmitter<WorkOrderDocument>();
  @Output() createWorkOrder = new EventEmitter<CreateWorkOrderRequest>();

  private indexMap = new Map<string, number>();
  protected readonly actionOptions: ActionOption[] = [
    { label: 'Edit', value: 'edit' },
    { label: 'Delete', value: 'delete' }
  ];
  private selectedActionByOrderId: Record<string, ActionValue | null> = {};
  protected openedActionOrderId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['timelineDates'] || changes['timescaleLabel']) {
      this.rebuildIndexMap();
    }
  }

  get gridTemplateColumns(): string {
    return `repeat(${this.timelineHeader.length}, minmax(120px, 1fr))`;
  }

  getWorkOrdersForCenter(centerId: string): WorkOrderDocument[] {
    return this.workOrders.filter((order) => order.data.workCenterId === centerId);
  }

  getGridColumn(order: WorkOrderDocument): string | null {
    const start = this.getIndexForDate(new Date(order.data.startDate));
    const end = this.getIndexForDate(new Date(order.data.endDate));
    if (start === null || end === null) {
      return null;
    }
    const safeEnd = Math.max(start, end);
    return `${start + 1} / ${safeEnd + 2}`;
  }

  onEditClick(order: WorkOrderDocument): void {
    this.editWorkOrder.emit(order);
  }

  onDeleteClick(order: WorkOrderDocument): void {
    this.deleteWorkOrder.emit(order);
  }

  onActionChange(order: WorkOrderDocument, action: ActionValue | null): void {
    if (!action) {
      return;
    }
    if (action === 'edit') {
      this.onEditClick(order);
    } else {
      this.onDeleteClick(order);
    }
    this.selectedActionByOrderId[order.docId] = null;
    this.openedActionOrderId = null;
  }

  onTimelineCellClick(workCenterId: string, date: Date, event: MouseEvent): void {
    event.stopPropagation();
    this.createWorkOrder.emit({
      workCenterId,
      startDate: this.formatDate(date)
    });
  }

  getSelectedAction(orderId: string): ActionValue | null {
    return this.selectedActionByOrderId[orderId] ?? null;
  }

  onActionOpen(orderId: string): void {
    this.openedActionOrderId = orderId;
  }

  onActionClose(orderId: string): void {
    if (this.openedActionOrderId === orderId) {
      this.openedActionOrderId = null;
    }
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

  private unitKey(date: Date): string {
    const d = new Date(date);
    if (this.timescaleLabel === 'Hour') {
      d.setMinutes(0, 0, 0);
      return d.toISOString();
    }
    if (this.timescaleLabel === 'Day') {
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (this.timescaleLabel === 'Week') {
      const day = d.getDay();
      const diff = (day + 6) % 7;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month';
type ActionValue = 'edit' | 'delete';

interface ActionOption {
  label: string;
  value: ActionValue;
}
