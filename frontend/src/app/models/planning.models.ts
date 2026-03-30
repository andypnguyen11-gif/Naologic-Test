export interface ComponentGapDocument {
  componentPartId: string;
  partNumber: string;
  componentName: string;
  partType: string;
  workCenterId: string | null;
  workCenterName: string | null;
  quantityPer: number;
  targetQuantity: number;
  quantityRequired: number;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityOnOrder: number;
  quantityAvailable: number;
  shortage: number;
  standardBuildDays: number;
  standardLeadDays: number;
  projectedReadyDays: number;
}
