import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss'
})
export class TimelineComponent {
  @Input({ required: true }) timescaleLabel = 'Day';
  @Input({ required: true }) workCenters: string[] = [];
  @Input({ required: true }) timelineHeader: string[] = [];
}
