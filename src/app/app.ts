import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WorkOrdersPage } from './work-orders/work-orders-page/work-orders-page';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, WorkOrdersPage],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('naologic');
}
