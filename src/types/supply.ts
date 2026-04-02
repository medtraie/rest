export interface Client {
  id: string;
  name: string;
  code?: string;
  localite?: string | number;
  region?: string;
  categorie?: string;
  repr?: string;
  dateDeb?: string;
  dateFin?: string;
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
