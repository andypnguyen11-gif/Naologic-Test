import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { WorkOrderDocument, WorkOrderStatus } from '../../../models/work-orders.models';

export interface WorkOrderPanelSubmitEvent {
  mode: 'create' | 'edit';
  orderId: string | null;
  value: {
    name: string;
    status: WorkOrderStatus;
    startDate: string;
    endDate: string;
  };
}

@Component({
  selector: 'app-work-order-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './work-order-panel.html',
  styleUrl: './work-order-panel.scss',
})
export class WorkOrderPanel implements OnChanges {
  @Input() open = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() order: WorkOrderDocument | null = null;
  @Output() closePanel = new EventEmitter<void>();
  @Output() saveOrder = new EventEmitter<WorkOrderPanelSubmitEvent>();

  protected readonly statusOptions: Array<{ label: string; value: WorkOrderStatus }> = [
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Complete', value: 'complete' },
    { label: 'Blocked', value: 'blocked' }
  ];

  protected readonly form;

  constructor(private readonly formBuilder: FormBuilder) {
    this.form = this.formBuilder.group(
      {
        name: ['', [Validators.required]],
        status: ['open' as WorkOrderStatus, [Validators.required]],
        startDate: ['', [Validators.required]],
        endDate: ['', [Validators.required]]
      },
      { validators: [this.dateRangeValidator] }
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetFormFromInputs();
      return;
    }

    if (this.open && (changes['mode'] || changes['order'])) {
      this.resetFormFromInputs();
    }
  }

  get title(): string {
    return 'Work Order Details';
  }

  get actionLabel(): string {
    return this.mode === 'edit' ? 'Save' : 'Create';
  }

  protected isFieldInvalid(fieldName: 'name' | 'status' | 'startDate' | 'endDate'): boolean {
    const field = this.form.get(fieldName);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected get showDateRangeError(): boolean {
    return !!this.form.errors?.['dateRange'] && (this.form.dirty || this.form.touched);
  }

  onClose(): void {
    this.closePanel.emit();
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    this.saveOrder.emit({
      mode: this.mode,
      orderId: this.order?.docId ?? null,
      value: {
        name: formValue.name ?? '',
        status: formValue.status ?? 'open',
        startDate: formValue.startDate ?? '',
        endDate: formValue.endDate ?? ''
      }
    });
  }

  private resetFormFromInputs(): void {
    if (this.mode === 'edit' && this.order) {
      this.form.reset({
        name: this.order.data.name,
        status: this.order.data.status,
        startDate: this.order.data.startDate,
        endDate: this.order.data.endDate
      });
    } else {
      const today = new Date();
      const startDate = this.formatDate(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      this.form.reset({
        name: '',
        status: 'open',
        startDate,
        endDate: this.formatDate(end)
      });
    }

    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;
    if (!startDate || !endDate) {
      return null;
    }

    return endDate >= startDate ? null : { dateRange: true };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
