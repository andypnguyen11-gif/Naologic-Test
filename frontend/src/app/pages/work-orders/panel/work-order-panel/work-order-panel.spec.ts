import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkOrderPanel } from './work-order-panel';

describe('WorkOrderPanel', () => {
  let component: WorkOrderPanel;
  let fixture: ComponentFixture<WorkOrderPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrderPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkOrderPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
