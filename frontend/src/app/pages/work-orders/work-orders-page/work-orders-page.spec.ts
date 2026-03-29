import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WorkOrdersPage } from './work-orders-page';
import { WorkOrdersService } from '../../../services/work-orders.service';
import { AuthService } from '../../../auth/auth.service';

describe('WorkOrdersPage', () => {
  const workOrdersService = jasmine.createSpyObj<WorkOrdersService>('WorkOrdersService', [
    'getWorkCenters',
    'getWorkOrders',
    'createWorkOrder',
    'updateWorkOrder',
    'deleteWorkOrder'
  ]);

  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['currentUser', 'logout', 'canManageWorkOrders']);

  beforeEach(async () => {
    workOrdersService.getWorkCenters.calls.reset();
    workOrdersService.getWorkOrders.calls.reset();
    authService.currentUser.calls.reset();
    authService.logout.calls.reset();
    authService.canManageWorkOrders.calls.reset();

    workOrdersService.getWorkCenters.and.returnValue(of([
      { docId: 'wc-001', docType: 'workCenter', data: { name: 'Extrusion Line A' } }
    ]));
    workOrdersService.getWorkOrders.and.returnValue(of([
      {
        docId: 'wo-001',
        docType: 'workOrder',
        data: {
          name: 'Order 1',
          workCenterId: 'wc-001',
          status: 'open',
          startDate: '2026-03-01',
          endDate: '2026-03-05'
        }
      }
    ]));
    authService.currentUser.and.returnValue({
      userId: '1',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'Admin'
    });
    authService.canManageWorkOrders.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [WorkOrdersPage],
      providers: [
        provideRouter([]),
        { provide: WorkOrdersService, useValue: workOrdersService },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  it('should load work centers and work orders on init', async () => {
    const fixture = TestBed.createComponent(WorkOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as any;
    expect(component.workCenters.length).toBe(1);
    expect(component.workOrders.length).toBe(1);
  });

  it('should open create mode when a timeline create event occurs', async () => {
    const fixture = TestBed.createComponent(WorkOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;

    component.onCreateWorkOrder({ workCenterId: 'wc-001', startDate: '2026-03-10' });

    expect(component.isPanelOpen).toBeTrue();
    expect(component.panelMode).toBe('create');
    expect(component.pendingCreateWorkCenterId).toBe('wc-001');
  });

  it('should log out through the auth service', async () => {
    const fixture = TestBed.createComponent(WorkOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;

    component.onLogout();

    expect(authService.logout).toHaveBeenCalled();
  });
});
