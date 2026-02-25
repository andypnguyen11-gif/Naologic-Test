import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { TimelineComponent } from '../timeline/timeline';
import { WorkCenterDocument, WorkOrderDocument } from '../../models/work-orders.models';
import { WorkOrdersService } from '../../services/work-orders.service';

@Component({
  selector: 'app-work-orders-page',
  imports: [CommonModule, TimelineComponent],
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
