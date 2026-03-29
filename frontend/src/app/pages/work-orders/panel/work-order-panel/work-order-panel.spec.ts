import { TestBed } from '@angular/core/testing';
import { WorkOrderPanel } from './work-order-panel';

describe('WorkOrderPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrderPanel]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(WorkOrderPanel);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should mark the form invalid when end date is before start date', () => {
    const fixture = TestBed.createComponent(WorkOrderPanel);
    const component = fixture.componentInstance as any;

    component.form.setValue({
      name: 'Order 1',
      status: 'open',
      startDate: { year: 2026, month: 3, day: 10 },
      endDate: { year: 2026, month: 3, day: 9 }
    });

    expect(component.form.errors?.['dateRange']).toBeTrue();
  });

  it('should emit a save event with ISO dates on submit', () => {
    const fixture = TestBed.createComponent(WorkOrderPanel);
    const component = fixture.componentInstance as any;
    spyOn(component.saveOrder, 'emit');

    component.mode = 'create';
    component.form.setValue({
      name: 'Order 1',
      status: 'open',
      startDate: { year: 2026, month: 3, day: 10 },
      endDate: { year: 2026, month: 3, day: 12 }
    });

    component.onSubmit();

    expect(component.saveOrder.emit).toHaveBeenCalledWith({
      mode: 'create',
      orderId: null,
      value: {
        name: 'Order 1',
        status: 'open',
        startDate: '2026-03-10',
        endDate: '2026-03-12'
      }
    });
  });
});
