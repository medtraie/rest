export interface Expense {
  id: string;
  code: string;
  type: 'bureau' | 'salaire' | 'cnss' | 'loyer' | 'charger dépôt' | 'équipement' | 'électricité' | 'transport' | 'autre';
  amount: number;
  paymentMethod: 'espèces' | 'chèques' | 'banque' | 'dette';
  date: string;
  note?: string;
}
export interface Revenue {
  id: string;
  date: string;
  totalCheque?: number;
  totalBank?: number;
  totalCash?: number;
  totalDebt?: number;
  totalAmount?: number;
  description?: string;
  paymentMethod?: 'cash' | 'check' | 'mixed';
  cashAmount?: number;
  checkAmount?: number;
  mygazAmount?: number;
  relatedOrderId?: string;
  relatedOrderType?: 'return' | 'supply' | 'expense' | 'other';
  driverName?: string;
  source?: string;
  amount?: number;
}
export interface BankTransfer {
  id: string;
  date: string;
  type: 'versement_espece' | 'remise_cheques' | 'retrait_bancaire';
  sourceAccount: 'espece' | 'cheque' | 'banque';
  destinationAccount: 'espece' | 'cheque' | 'banque';
  amount: number;
  description: string;
  status: 'pending' | 'validated';
  validatedAt?: string;
  validatedBy?: string;
}
export interface CashOperation {
  id: string;
  date: string;
  name: string;
  amount: number;
  type: 'versement' | 'retrait';
  accountAffected: 'espece' | 'banque' | 'cheque' | 'autre';
  accountDetails?: string; // Pour "autre" compte
  status: 'pending' | 'validated';
  validatedAt?: string;
  validatedBy?: string;
}
export interface FinancialTransaction {
  id: string;
  date: string;
  type: 'encaissement' | 'transfert' | 'retrait' | 'versement' | 'dépense' | 'réparation';
  description: string;
  amount: number;
  sourceAccount?: string;
  destinationAccount?: string;
  accountDetails?: string;
  status: 'pending' | 'validated' | 'completed';
  createdAt: string;
}
export interface FuelVehicle {
  id: string;
  plate: string;
  driverName: string;
  kmCurrent: number;
  status: 'actif' | 'atelier';
}
export interface FuelTank {
  capacityLiters: number;
  currentLiters: number;
  lastUpdatedISO: string;
}
export interface FillInternal {
  id: string;
  dateISO: string;
  vehicleId: string;
  liters: number;
  kmAtFill: number;
  note?: string;
}
export interface FillExternal {
  id: string;
  dateISO: string;
  vehicleId: string;
  liters: number;
  cost: number;
  station: string;
  invoiceRef?: string;
}
export interface TireChange {
  id: string;
  dateISO: string;
  vehicleId: string;
  reference: string;
  brand: string;
  note?: string;
}
export interface OilChange {
  id: string;
  dateISO: string;
  vehicleId: string;
  kmAtChange: number;
  oilLiters: number;
  filters: {
    oil: boolean;
    air: boolean;
    diesel: boolean;
  };
  note?: string;
}
export interface Repair {
  id: string;
  date: string;
  truckId: string;
  type: 'mecanique' | 'electrique' | 'garage';
  totalCost: number;
  paidAmount: number;
  debtAmount: number;
  paymentMethod: 'especes' | 'cheque' | 'virement';
  attachments?: string[]; // URLs or file paths
  remarks: string;
}
export interface BottleType {
  id: string;
  code?: string;
  name: string;
  capacity: string;
  totalQuantity: number;
  distributedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  taxRate: number;
  purchasePrice?: number;
  color?: string;
}
export interface Truck {
  id: string;
  matricule: string;
  driverId: string;
  isActive: boolean;
  currentLoad: TruckLoad[];
  updatedAt?: string;
  nextReturnDate?: string;
  reposReason?: string;
  techStatus?: 'operational' | 'maintenance' | 'repair';
  truckType: 'camion' | 'remorque' | 'petit-camion' | 'clark';
}
export interface TruckLoad {
  bottleTypeId: string;
  quantity: number;
  loadDate: string;
}
export interface Driver {
  id: string;
  name: string;
  code?: string;
  aideLivreurs?: string;
  debt: number;
  advances: number;
  balance: number;
  debtThreshold?: number;
  foreignBottlesThreshold?: number;
  totalForeignBottles?: number;
  isClosedDueDebt?: boolean;
  isClosedDueForeign?: boolean;
  isUnavailable?: boolean;
  remainingBottles?: Record<string, number>; // bottleTypeId -> quantity
  transactions?: Transaction[];
  lastRCUpdate?: string;
  rcHistory?: RcHistoryEntry[];
}
export interface CompanyExchange {
  id: string;
  code?: string;
  companyName: string;
  clientName?: string;
  bottleType: string;
  quantityGiven: number;
  quantityReceived: number;
  priceDifference: number;
  date: string;
  isPaidByUs: boolean;
  paidBy?: 'nous' | 'client' | 'egale';
}
export type Exchange = CompanyExchange;
export interface Transaction {
  id: string;
  type: 'supply' | 'return' | 'exchange' | 'factory';
  date: string;
  truckId?: string;
  driverId?: string;
  bottleTypes: Array<{
    bottleTypeId: string;
    quantity: number;
    status?: 'sold' | 'empty' | 'unsold' | 'foreign' | 'defective' | 'lost';
  }>;
  totalValue: number;
}
export interface RcChange {
  bottleTypeId: string;
  bottleTypeName?: string;
  previousQty: number;
  newQty: number;
  diff: number;
}
export interface RcHistoryEntry {
  date: string;
  changes: RcChange[];
}
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

export interface Supplier {
  id: string;
  name: string;
  debts: Array<{
    bottleTypeId: string;
    emptyDebt: number;
    defectiveDebt: number;
  }>;
  transactionCount: number;
}

export interface Brand {
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
  truckId?: string;
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
export interface ExpenseReport {
  description: string;
  price: number;
}
export interface ReturnOrder {
  id: string;
  orderNumber: string;
  date: string;
  supplyOrderId: string;
  supplyOrderNumber: string;
  driverId?: string;
  driverName?: string;
  clientId?: string;
  clientName?: string;
  items: ReturnOrderItem[];
  expenses?: ExpenseReport[];
  paymentCash?: number;
  paymentCheque?: number;
  paymentMygaz?: number;
  paymentTotal?: number;
  paymentDebt?: number;
}
export interface ReturnOrderItem {
  bottleTypeId: string;
  bottleTypeName: string;
  emptyQuantity: number;
  fullQuantity: number;
  returnedEmptyQuantity: number;
  returnedFullQuantity: number;
  foreignQuantity: number;
  defectiveQuantity: number;
  lostQuantity: number;
  soldQuantity: number;     // Maintenant remplie selon : returnedEmptyQuantity + consigneQuantity
  consigneQuantity: number; // Nouveau : quantité de bouteilles vendues directement
  unitPrice?: number;       // Nouveau : prix unitaire spécifique à ce bon
  consignePrice?: number;   // Nouveau : prix de la Consigne spécifique à ce bon
}
export interface ForeignBottle {
  id: string;
  returnOrderId: string;
  companyName: string;
  bottleType: string;
  quantity: number;
  type: 'normal' | 'defective';
  date: string;
}
export interface DefectiveBottle {
  id: string;
  returnOrderId: string;
  bottleTypeId: string;
  bottleTypeName: string;
  quantity: number;
  date: string;
}
export interface EmptyBottlesStock {
  id: string;
  bottleTypeId: string;
  bottleTypeName: string;
  quantity: number;
  lastUpdated: string;
}

export interface StockHistory {
  id: string;
  date: string;
  bottleTypeId: string;
  bottleTypeName: string;
  stockType: 'empty' | 'defective' | 'all';
  changeType: 'add' | 'remove' | 'adjustment' | 'return' | 'factory';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  note?: string;
}

export interface TruckAssignment {
  id: string;
  truckId: string;
  driverId: string;
  assignedAt: string;
  unassignedAt?: string;
  assignedBy: string;
  reason?: string;
  endDate?: string;
}
export interface FuelPurchase {
  id: string | number;
  date: Date;
  quantityLiters: number;
  price: number;
  paymentMethod: 'Espèces' | 'Chèque' | 'Virement';
}
// Ajout non destructif: fusion d’interface pour inclure le kilométrage
export interface FuelConsumption {
  id: string | number;
  date: Date;
  liters: number;
  driver: string;
  truck: string;
  mileageKm?: number;
}
export interface FuelDrain {
  id: string | number;
  date: Date;
  quantityLiters: number;
  price: number;
  paymentMethod: 'Espèces' | 'Chèque' | 'Virement';
}
