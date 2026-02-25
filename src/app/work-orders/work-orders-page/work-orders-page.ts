import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineComponent } from '../timeline/timeline';

@Component({
  selector: 'app-work-orders-page',
  imports: [CommonModule, TimelineComponent],
  templateUrl: './work-orders-page.html',
  styleUrl: './work-orders-page.scss',
  standalone: true
})
export class WorkOrdersPage {
  protected readonly timescales = ['Day', 'Week', 'Month'];
  protected readonly selectedTimescale = 'Day';
  protected readonly workCenters = [
    'Extrusion Line A',
    'CNC Machine 1',
    'Assembly Station',
    'Quality Control',
    'Packaging Line'
  ];
  protected readonly timelineHeader = Array.from({ length: 14 }, (_, i) => `Day ${i + 1}`);
}
