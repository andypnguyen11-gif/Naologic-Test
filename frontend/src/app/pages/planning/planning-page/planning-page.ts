import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import * as Highcharts from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import { firstValueFrom } from 'rxjs';
import { ComponentGapDocument } from '../../../models/planning.models';
import { PlanningService } from '../../../services/planning.service';

@Component({
  selector: 'app-planning-page',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, HighchartsChartComponent],
  templateUrl: './planning-page.html',
  styleUrl: './planning-page.scss'
})
export class PlanningPage implements OnInit {
  private readonly planningService = inject(PlanningService);

  protected readonly productOptions: PlanningProductOption[] = [
    { partId: 'part-tractor-1000', label: 'Tractor Model 1000' }
  ];
  protected readonly targetOptions = [4, 6, 8, 10, 12];

  protected selectedPartId = 'part-tractor-1000';
  protected selectedTargetQty = 10;
  protected componentGaps: ComponentGapDocument[] = [];
  protected isLoading = true;
  protected loadError: string | null = null;

  protected requiredVsAvailableOptions: Highcharts.Options = {};
  protected shortageOptions: Highcharts.Options = {};
  protected readinessOptions: Highcharts.Options = {};

  async ngOnInit(): Promise<void> {
    await this.loadPlanningData();
  }

  protected get selectedProductLabel(): string {
    return this.productOptions.find((option) => option.partId === this.selectedPartId)?.label ?? 'Product';
  }

  protected get maxBuildableNow(): number {
    if (!this.componentGaps.length) {
      return 0;
    }

    return Math.min(
      ...this.componentGaps.map((item) => Math.floor(item.quantityAvailable / item.quantityPer))
    );
  }

  protected get totalShortageUnits(): number {
    return this.componentGaps.reduce((sum, item) => sum + item.shortage, 0);
  }

  protected get criticalComponent(): string {
    return this.componentGaps[0]?.componentName ?? 'None';
  }

  protected get criticalReadyDays(): number {
    return Math.max(0, ...this.componentGaps.map((item) => item.projectedReadyDays));
  }

  protected async onFiltersChanged(): Promise<void> {
    await this.loadPlanningData();
  }

  protected trackByComponent(_: number, item: ComponentGapDocument): string {
    return item.componentPartId;
  }

  private async loadPlanningData(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;

    try {
      const componentGaps = await firstValueFrom(
        this.planningService.getComponentGaps(this.selectedPartId, this.selectedTargetQty)
      );
      this.componentGaps = [...componentGaps].sort((left, right) => right.shortage - left.shortage);
      this.buildCharts();
    } catch {
      this.loadError = 'Unable to load planning data. Check that the API is running and Planning.sql has been applied.';
      this.componentGaps = [];
      this.buildCharts();
    } finally {
      this.isLoading = false;
    }
  }

  private buildCharts(): void {
    const categories = this.componentGaps.map((item) => item.componentName);
    const labelStyle = {
      color: '#66708f',
      fontSize: '11px',
      fontFamily: 'Circular-Std, sans-serif'
    };

    this.requiredVsAvailableOptions = {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        spacingTop: 8,
        spacingLeft: 0,
        spacingRight: 0
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: {
        itemStyle: {
          color: '#23304d',
          fontWeight: '600'
        }
      },
      xAxis: {
        categories,
        labels: {
          style: labelStyle
        },
        lineColor: '#e4e9ff'
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: '#edf1ff',
        labels: {
          style: labelStyle
        }
      },
      tooltip: {
        shared: true,
        valueDecimals: 0
      },
      plotOptions: {
        column: {
          borderRadius: 6,
          pointPadding: 0.12,
          groupPadding: 0.16
        }
      },
      series: [
        {
          type: 'column',
          name: 'Required',
          color: '#4d68ff',
          data: this.componentGaps.map((item) => item.quantityRequired)
        },
        {
          type: 'column',
          name: 'Available',
          color: '#4ec7a5',
          data: this.componentGaps.map((item) => item.quantityAvailable)
        }
      ]
    };

    this.shortageOptions = {
      chart: {
        type: 'bar',
        backgroundColor: 'transparent',
        spacingTop: 8,
        spacingLeft: 0,
        spacingRight: 0
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories,
        labels: {
          style: labelStyle
        },
        lineColor: '#e4e9ff'
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: '#edf1ff',
        labels: {
          style: labelStyle
        }
      },
      tooltip: {
        valueDecimals: 0,
        pointFormat: '<span style="color:{point.color}">\u25CF</span> Shortage: <b>{point.y}</b><br/>'
      },
      plotOptions: {
        bar: {
          borderRadius: 6
        }
      },
      series: [
        {
          type: 'bar',
          name: 'Shortage',
          color: '#ff8b5c',
          data: this.componentGaps.map((item) => item.shortage)
        }
      ]
    };

    this.readinessOptions = {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        spacingTop: 8,
        spacingLeft: 0,
        spacingRight: 0
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories,
        labels: {
          style: labelStyle
        },
        lineColor: '#e4e9ff'
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: '#edf1ff',
        labels: {
          style: labelStyle
        }
      },
      tooltip: {
        valueSuffix: ' days'
      },
      plotOptions: {
        column: {
          borderRadius: 6
        }
      },
      series: [
        {
          type: 'column',
          name: 'Projected Ready Days',
          colorByPoint: true,
          data: this.componentGaps.map((item, index) => ({
            y: item.projectedReadyDays,
            color: ['#7b7fff', '#65c4ff', '#4ec7a5', '#ffd166', '#ff8b5c', '#ef6f90'][index % 6]
          }))
        }
      ]
    };
  }
}

interface PlanningProductOption {
  partId: string;
  label: string;
}
