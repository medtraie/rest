export interface Client {
  id: string;
  name: string;
}

export interface SupplyOrder {
  id: string;
  orderNumber: string;
  reference?: string;
  date: string;
  driverId?: string;
  driverName?: string;
  clientId?: string;
  clientName?: string;
  items: SupplyOrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface SupplyOrderItem {
  bottleTypeId: string;
  bottleTypeName: string;
  emptyQuantity: number;
  fullQuantity: number;
  unitPrice: number;
  taxLabel: string;
  amount: number;
}
