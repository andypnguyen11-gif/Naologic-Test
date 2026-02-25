import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-work-order-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './work-order-panel.html',
  styleUrl: './work-order-panel.scss',
})
export class WorkOrderPanel {
  @Input() open = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Output() closePanel = new EventEmitter<void>();

  get title(): string {
    return this.mode === 'edit' ? 'Work Order Details' : 'Work Order Details';
  }

  get actionLabel(): string {
    return this.mode === 'edit' ? 'Save' : 'Create';
  }

  onClose(): void {
    this.closePanel.emit();
  }
}
