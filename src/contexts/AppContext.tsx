import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { kvGet, kvSet } from "@/lib/kv";
import { supabase } from "@/lib/supabaseClient";
import { supabaseService } from "@/lib/supabaseService";
import {
  Client,
  Driver,
  Truck,
  Supply,
  SupplyReturn,
  CashOperation,
  Expense,
  Repair,
  Exchange,
  DefectiveBottle,
  Inventory,
  FuelPurchase,
  FuelConsumption,
  FuelDrain,
  OilPurchase,
  OilConsumption,
  OilDrain,
  Revenue,
  BankTransfer,
  FinancialTransaction,
  BottleType,
  ForeignBottle,
  EmptyBottlesStock,
  Brand,
  StockHistory,
  Supplier,
} from "@/types";

function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stickyValue = window.localStorage.getItem(key);
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
  });
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cloud = await kvGet<T>(key);
        if (cloud !== null && cloud !== undefined && active) {
          setValue(cloud);
          try {
            window.localStorage.setItem(key, JSON.stringify(cloud));
          } catch {}
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [key]);
  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      (async () => {
        const cloud = await kvGet<T>(key);
        if (cloud !== null && cloud !== undefined) {
          setValue(cloud);
          try {
            window.localStorage.setItem(key, JSON.stringify(cloud));
          } catch {}
        }
      })();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [key]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
    (async () => {
      try {
        await kvSet(key, value as any);
      } catch {}
    })();
  }, [key, value]);
  return [value, setValue];
}

export type PermissionKey =
  | "dashboard"
  | "inventory"
  | "trucks"
  | "drivers"
  | "clients"
  | "supply-return"
  | "petit-camion"
  | "defective-stock"
  | "exchanges"
  | "factory"
  | "fuel-management"
  | "repairs"
  | "expenses"
  | "depenses-copt"
  | "revenue"
  | "reports"
  | "live-map"
  | "transfer"
  | "settings"
  | "accounting";

type Role = {
  id: string;
  name: string;
  permissions: Array<PermissionKey | "*">;
};

type RoleAssignment = {
  id: string;
  email: string;
  roleId: string;
};

const permissionCatalog: Array<{ key: PermissionKey; label: string }> = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "inventory", label: "Inventaire" },
  { key: "trucks", label: "Camions" },
  { key: "drivers", label: "Chauffeurs" },
  { key: "clients", label: "Clients" },
  { key: "supply-return", label: "Distrubition" },
  { key: "petit-camion", label: "Allogaz" },
  { key: "defective-stock", label: "Stock Défectueux" },
  { key: "exchanges", label: "Échanges" },
  { key: "factory", label: "Fournisseurs" },
  { key: "fuel-management", label: "Gestion Carburant & Huile" },
  { key: "repairs", label: "Gestion des Réparations" },
  { key: "expenses", label: "Dépenses Diverses" },
  { key: "depenses-copt", label: "Dépenses Copt" },
  { key: "revenue", label: "Recette" },
  { key: "reports", label: "Rapports" },
  { key: "live-map", label: "Carte Live" },
  { key: "transfer", label: "Transfert" },
  { key: "accounting", label: "Comptabilité" },
  { key: "settings", label: "Paramètres" },
];

const defaultRoles: Role[] = [
  { id: "admin", name: "Admin", permissions: ["*"] },
  {
    id: "manager",
    name: "Gestionnaire",
    permissions: [
      "dashboard",
      "inventory",
      "trucks",
      "drivers",
      "clients",
      "supply-return",
      "petit-camion",
      "defective-stock",
      "exchanges",
      "factory",
      "fuel-management",
      "repairs",
      "expenses",
      "depenses-copt",
      "revenue",
      "reports",
      "live-map",
      "transfer",
    ],
  },
  { id: "viewer", name: "Consultation", permissions: ["dashboard", "reports", "live-map", "transfer"] },
];

// AppContextType interface additions
interface AppContextType {
  clients: Client[];
  addClient: (client: Client) => Promise<string | null>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  brands: Brand[];
  addBrand: (brand: Brand) => Promise<void>;
  drivers: Driver[];
  addDriver: (driver: Driver) => Promise<void>;
  updateDriver: (driverId: string, updates: Partial<Driver>) => Promise<void>;
  updateDriverDebt: (driverId: string, delta: number) => Promise<void>;
  // Enregistre le paiement et ajuste la dette et les avances selon le montant
  recordDriverPayment: (driverId: string, amount: number) => Promise<void>;
  deleteDriver: (id: string) => Promise<void>;
  canDeleteDriver: (driverId: string) => { allowed: boolean; reason?: string };
  deleteDriver: (id: string) => Promise<void>;
  updateBrand: (id: string, patch: Partial<Brand>) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  trucks: Truck[];
  addTruck: (truck: Truck) => Promise<void>;
  // Fonctions de gestion des camions requises pour la page Gestion des Camions
  updateTruck: (id: string, patch: Partial<Truck>) => Promise<void>;
  deleteTruck: (id: string) => Promise<void>;
  clearAllTrucks: () => Promise<void>;
  bulkSetRepos: (ids: string[], reposReason?: string, nextReturnDate?: string) => Promise<void>;
  bulkReactivate: (ids: string[]) => Promise<void>;
  bulkDissociateDriver: (ids: string[]) => Promise<void>;
  driverHasActiveTruck: (driverId: string) => Truck | undefined;
  truckAssignments: any[];
  supplies: Supply[];
  addSupply: (supply: Supply) => Promise<void>;
  supplyReturns: SupplyReturn[];
  addSupplyReturn: (supplyReturn: SupplyReturn) => Promise<void>;
  supplyOrders: any[];
  addSupplyOrder: (order: any) => Promise<void>;
  updateSupplyOrder: (order: any) => Promise<void>;
  deleteSupplyOrder: (id: string) => Promise<void>;
  returnOrders: any[];
  addReturnOrder: (order: any) => Promise<void>;
  deleteReturnOrder: (id: string) => Promise<void>;
  cashOperations: CashOperation[];
  addCashOperation: (op: CashOperation) => Promise<void>;
  expenses: Expense[];
  addExpense: (expense: Expense) => Promise<void>;
  updateExpense: (id: string, patch: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string | number) => Promise<void>;
  repairs: Repair[];
  addRepair: (repair: Repair) => Promise<void>;
  updateRepair: (id: string, patch: Partial<Repair>) => Promise<void>;
  deleteRepair: (id: string) => Promise<void>;
  exchanges: Exchange[];
  addExchange: (exchange: Exchange) => Promise<void>;
  emptyBottlesStock: EmptyBottlesStock[];
  addEmptyStock: (stock: EmptyBottlesStock) => Promise<void>;
  updateEmptyBottlesStock: (id: string, patch: Partial<EmptyBottlesStock>) => Promise<void>;
  updateEmptyBottlesStockByBottleType: (
    bottleTypeId: string,
    delta: number,
    customChangeType?: 'add' | 'remove' | 'return' | 'factory',
    customNote?: string,
    customMeta?: {
      truckId?: string;
      supplierId?: string;
      blReference?: string;
      driverId?: string;
      driverName?: string;
      operationId?: string;
    }
  ) => Promise<void>;
  defectiveStock: DefectiveBottle[];
  addDefectiveStock: (stock: DefectiveBottle) => Promise<void>;
  addDefectiveBottle: (bottle: DefectiveBottle) => Promise<void>;
  updateDefectiveBottlesStock: (id: string, patch: Partial<DefectiveBottle>) => Promise<void>;
  bottleTypes: BottleType[];
  addBottleType: (bottle: BottleType) => Promise<BottleType | null>;
  updateBottleType: (id: string, patch: Partial<BottleType>) => Promise<BottleType | null>;
  deleteBottleType: (id: string) => Promise<void>;
  transactions: any[];
  addTransaction: (transaction: any) => Promise<void>;
  foreignBottles: ForeignBottle[];
  addForeignBottle: (bottle: ForeignBottle) => Promise<void>;
  inventory: Inventory[];
  updateInventory: (id: string, patch: Partial<Inventory>) => Promise<void>;
  clearAllInventory: () => Promise<void>;
  revenues: Revenue[];
  addRevenue: (revenue: Omit<Revenue, "id"> & { id?: string }) => Promise<void>;
  bankTransfers: BankTransfer[];
  addBankTransfer: (transfer: BankTransfer) => Promise<void>;
  updateBankTransfer: (id: string, patch: Partial<BankTransfer>) => Promise<void>;
  validateBankTransfer: (id: string, validator?: string) => Promise<void>;
  deleteBankTransfer: (id: string) => Promise<void>;
  financialTransactions: FinancialTransaction[];
  addFinancialTransaction: (tx: Omit<FinancialTransaction, 'id'>) => Promise<void>;
  stockHistory: StockHistory[];
  addStockHistory: (history: Omit<StockHistory, 'id'>) => Promise<void>;
  suppliers: Supplier[];
  addSupplier: (supplier: Supplier) => Promise<void>;
  updateSupplier: (id: string, patch: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  expenseTypes: string[];
  addExpenseType: (type: string) => void;
  roles: Role[];
  roleAssignments: RoleAssignment[];
  availablePermissions: Array<{ key: PermissionKey; label: string }>;
  currentUserEmail: string | null;
  currentRole: Role | null;
  addRole: (name: string) => Promise<void>;
  updateRolePermissions: (roleId: string, permissions: PermissionKey[]) => Promise<void>;
  assignRoleToEmail: (email: string, roleId: string) => Promise<void>;
  removeRoleAssignment: (assignmentId: string) => Promise<void>;
  hasPermission: (permission: PermissionKey) => boolean;
  // Data management functions
  exportData: () => void;
  importData: (jsonData: string) => void;
  clearAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialTrucks: Truck[] = [];

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [supplyReturns, setSupplyReturns] = useState<SupplyReturn[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<any[]>([]);
  const [returnOrders, setReturnOrders] = useState<any[]>([]);
  const [cashOperations, setCashOperations] = useState<CashOperation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [emptyBottlesStock, setEmptyBottlesStock] = useState<EmptyBottlesStock[]>([]);
  const [defectiveStock, setDefectiveStock] = useState<DefectiveBottle[]>([]);
  const [bottleTypes, setBottleTypes] = useState<BottleType[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [foreignBottles, setForeignBottles] = useState<ForeignBottle[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [fuelPurchases, setFuelPurchases] = useState<FuelPurchase[]>([]);
  const [fuelConsumptions, setFuelConsumptions] = useState<FuelConsumption[]>([]);
  const [fuelDrains, setFuelDrains] = useState<FuelDrain[]>([]);
  const [oilPurchases, setOilPurchases] = useState<OilPurchase[]>([]);
  const [oilConsumptions, setOilConsumptions] = useState<OilConsumption[]>([]);
  const [oilDrains, setOilDrains] = useState<OilDrain[]>([]);
  
  // New states for Revenue page
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [bankTransfers, setBankTransfers] = useState<BankTransfer[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [driverDebtThresholds, setDriverDebtThresholds] = useStickyState<Record<string, number>>({}, 'driver-debt-thresholds');
  const [driverForeignThresholds, setDriverForeignThresholds] = useStickyState<Record<string, number>>({}, 'driver-foreign-thresholds');

  // Bootstrap financial data from Supabase on app start
  React.useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const [txs, ops, bts, revs] = await Promise.all([
          supabaseService.getAll<FinancialTransaction>("financial_transactions"),
          supabaseService.getAll<CashOperation>("cash_operations"),
          supabaseService.getAll<BankTransfer>("bank_transfers"),
          supabaseService.getAll<Revenue>("revenues"),
        ]);
        if (Array.isArray(txs)) setFinancialTransactions(txs);
        if (Array.isArray(ops)) setCashOperations(ops);
        if (Array.isArray(bts)) setBankTransfers(bts);
        if (Array.isArray(revs)) setRevenues(revs);
      } catch {}
    })();
  }, [currentUserId]);
  const [expenseTypes, setExpenseTypes] = useState<string[]>(['bureau', 'salaire', 'cnss', 'loyer', 'charger dépôt', 'équipement', 'électricité', 'transport', 'autre']);

  const normalizeAccount = (value?: string) => {
    const key = (value || '').toLowerCase();
    if (key === 'especes' || key === 'espèces' || key === 'espèce' || key === 'espece') return 'espece';
    if (key === 'cheque' || key === 'chèque' || key === 'chèques') return 'cheque';
    if (key === 'banque' || key === 'virement' || key === 'bank') return 'banque';
    if (key === 'cash') return 'espece';
    if (key === 'check') return 'cheque';
    if (key === 'autre' || key === 'dette') return 'autre';
    return 'autre';
  };
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  // Moved currentUserEmail and currentUserId to top of component to avoid ReferenceError
  const currentRole = React.useMemo(() => {
    if (!currentUserEmail) return null;
    const assignment = roleAssignments.find(a => a.email.toLowerCase() === currentUserEmail.toLowerCase());
    if (!assignment) return roles.find(r => r.id === "admin") ?? null;
    return roles.find(r => r.id === assignment.roleId) ?? null;
  }, [currentUserEmail, roleAssignments, roles]);
  const hasPermission = (permission: PermissionKey) => {
    if (!currentRole) return true;
    const perms = currentRole.permissions;
    if (perms.includes("*")) return true;
    return perms.includes(permission);
  };
  const addRole = async (name: string) => {
    const baseId = name.trim().toLowerCase().replace(/\s+/g, "-");
    const id = roles.some(r => r.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
    const newRole: Role = { id, name: name.trim(), permissions: [] };
    const created = await supabaseService.create<Role>("roles", newRole);
    if (created) {
      setRoles(prev => [...prev, created]);
    }
  };
  const updateRolePermissions = async (roleId: string, permissions: PermissionKey[]) => {
    const updated = await supabaseService.update<Role>("roles", roleId, { permissions });
    if (updated) {
      setRoles(prev => prev.map(r => (r.id === roleId ? updated : r)));
    }
  };
  const assignRoleToEmail = async (email: string, roleId: string) => {
    const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const newAssignment: RoleAssignment = { id, email, roleId };
    const created = await supabaseService.create<RoleAssignment>("role_assignments", newAssignment);
    if (created) {
      setRoleAssignments(prev => [...prev, created]);
    }
  };
  const removeRoleAssignment = async (assignmentId: string) => {
    const success = await supabaseService.delete("role_assignments", assignmentId);
    if (success) {
      setRoleAssignments(prev => prev.filter(a => a.id !== assignmentId));
    }
  };
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setCurrentUserEmail(data.session?.user?.email ?? null);
      setCurrentUserId(data.session?.user?.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserEmail(session?.user?.email ?? null);
      setCurrentUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Fetch initial data from Supabase
  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
       const [
         clientsData,
         driversData,
         trucksData,
         suppliersData,
         brandsData,
         suppliesData,
         supplyReturnsData,
         supplyOrdersData,
         returnOrdersData,
         bottleTypesData,
         foreignBottlesData,
         truckAssignmentsData,
         cashOperationsData,
         expensesData,
         repairsData,
         exchangesData,
         emptyBottlesStockData,
         defectiveStockData,
         transactionsData,
         inventoryData,
         fuelPurchasesData,
         fuelConsumptionsData,
         fuelDrainsData,
         oilPurchasesData,
         oilConsumptionsData,
         oilDrainsData,
         revenuesData,
         bankTransfersData,
         financialTransactionsData,
         stockHistoryData,
         expenseTypesData,
         rolesData,
         roleAssignmentsData
       ] = await Promise.all([
         supabaseService.getAll<Client>("clients"),
         supabaseService.getAll<Driver>("drivers"),
         supabaseService.getAll<Truck>("trucks"),
         supabaseService.getAll<Supplier>("suppliers"),
         supabaseService.getAll<Brand>("brands"),
         supabaseService.getAll<Supply>("supplies"),
         supabaseService.getAll<SupplyReturn>("supply_returns"),
         supabaseService.getAll<any>("supply_orders"),
         supabaseService.getAll<any>("return_orders"),
         supabaseService.getAll<BottleType>("bottle_types"),
         supabaseService.getAll<ForeignBottle>("foreign_bottles"),
         supabaseService.getAll<any>("truck_assignments"),
         supabaseService.getAll<CashOperation>("cash_operations"),
         supabaseService.getAll<Expense>("expenses"),
         supabaseService.getAll<Repair>("repairs"),
         supabaseService.getAll<Exchange>("exchanges"),
         supabaseService.getAll<EmptyBottlesStock>("empty_bottles_stock"),
         supabaseService.getAll<DefectiveBottle>("defective_stock"),
         supabaseService.getAll<any>("transactions"),
         supabaseService.getAll<Inventory>("inventory"),
         supabaseService.getAll<FuelPurchase>("fuel_purchases"),
         supabaseService.getAll<FuelConsumption>("fuel_consumptions"),
         supabaseService.getAll<FuelDrain>("fuel_drains"),
         supabaseService.getAll<OilPurchase>("oil_purchases"),
         supabaseService.getAll<OilConsumption>("oil_consumptions"),
         supabaseService.getAll<OilDrain>("oil_drains"),
         supabaseService.getAll<Revenue>("revenues"),
         supabaseService.getAll<BankTransfer>("bank_transfers"),
         supabaseService.getAll<FinancialTransaction>("financial_transactions"),
         supabaseService.getAll<StockHistory>("stock_history"),
         supabaseService.getAll<any>("expense_types"),
         supabaseService.getAll<Role>("roles"),
         supabaseService.getAll<RoleAssignment>("role_assignments"),
       ]);
 
       setClients(clientsData);
       setDrivers(driversData);
       setTrucks(trucksData);
       setSuppliers(suppliersData);
       setBrands(brandsData);
       setSupplies(suppliesData);
       setSupplyReturns(supplyReturnsData);
       setSupplyOrders(supplyOrdersData);
       setReturnOrders(returnOrdersData);
       setBottleTypes(bottleTypesData);
       setForeignBottles(foreignBottlesData);
       setTruckAssignments(truckAssignmentsData);
       setCashOperations(cashOperationsData);
       setExpenses(expensesData);
       setRepairs(repairsData);
       setExchanges(exchangesData);
       setEmptyBottlesStock(emptyBottlesStockData);
       setDefectiveStock(defectiveStockData);
       setTransactions(transactionsData);
       setInventory(inventoryData);
       setFuelPurchases(fuelPurchasesData);
       setFuelConsumptions(fuelConsumptionsData);
       setFuelDrains(fuelDrainsData);
       setOilPurchases(oilPurchasesData);
       setOilConsumptions(oilConsumptionsData);
       setOilDrains(oilDrainsData);
       setRevenues(revenuesData);
       setBankTransfers(bankTransfersData);
       setFinancialTransactions(financialTransactionsData);
       setStockHistory(stockHistoryData);
       if (expenseTypesData.length > 0) {
         setExpenseTypes(expenseTypesData.map((t: any) => t.name || t));
       }
       if (rolesData.length > 0) {
         setRoles(rolesData);
       }
       setRoleAssignments(roleAssignmentsData);
     };

    fetchData();
  }, [currentUserId]);

    const addExpenseType = async (type: string) => {
      if (!expenseTypes.includes(type)) {
        const created = await supabaseService.create<any>("expense_types", { name: type });
        if (created) {
          setExpenseTypes(prev => {
            const newTypes = [...prev];
            const autreIndex = newTypes.indexOf('autre');
            if (autreIndex !== -1) {
              newTypes.splice(autreIndex, 0, type);
              return newTypes;
            }
            return [...newTypes, type];
          });
        }
      }
    };
  
    const addClient = async (client: Client) => {
      const id = client.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newClient = { ...client, id };
      const created = await supabaseService.create<Client>("clients", newClient);
      if (created) {
        setClients((prev) => [...prev, created]);
        return created.id;
      }
      return null;
    };

    const updateClient = async (id: string, patch: Partial<Client>) => {
      const updated = await supabaseService.update<Client>("clients", id, patch);
      if (updated) {
        setClients((prev) => prev.map((c) => (c.id === id ? updated : c)));
      }
    };

    const deleteClient = async (id: string) => {
      const success = await supabaseService.delete("clients", id);
      if (success) {
        setClients((prev) => prev.filter((c) => c.id !== id));
      }
    };

    const addSupplier = async (supplier: Supplier) => {
      const id = supplier.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newSupplier = { ...supplier, id };
      const created = await supabaseService.create<Supplier>("suppliers", newSupplier);
      if (created) {
        setSuppliers((prev) => [...prev, created]);
      }
    };

    const updateSupplier = async (id: string, patch: Partial<Supplier>) => {
      const updated = await supabaseService.update<Supplier>("suppliers", id, patch);
      if (updated) {
        setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
    };

    const deleteSupplier = async (id: string) => {
      const success = await supabaseService.delete("suppliers", id);
      if (success) {
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
      }
    };

    const addBrand = async (brand: Brand) => {
      const providedId = typeof brand.id === 'string' ? brand.id.trim() : brand.id;
      const id = providedId && String(providedId).length > 0
        ? String(providedId)
        : (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newBrand = { ...brand, id };
      const created = await supabaseService.create<Brand>("brands", newBrand);
      if (created) {
        setBrands(prev => [...prev, created]);
      }
    };
  
    const updateBrand = async (id: string, patch: Partial<Brand>) => {
      const updated = await supabaseService.update<Brand>("brands", id, patch);
      if (updated) {
        setBrands(prev => prev.map(b => (b.id === id ? updated : b)));
      }
    };
  
    const deleteBrand = async (id: string) => {
      const success = await supabaseService.delete("brands", id);
      if (success) {
        setBrands(prev => prev.filter(b => b.id !== id));
      }
    };

    const addDriver = async (driver: Driver) => {
      const id = driver.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newDriver = { ...driver, id };
      const created = await supabaseService.create<Driver>("drivers", newDriver);
      if (created) {
        setDrivers(prev => [...prev, { ...newDriver, ...created }]);
      }
    };
  
    const canDeleteDriver = (driverId: string) => {
      const d = drivers.find(dr => String(dr.id) === String(driverId));
      if (!d) return { allowed: true };
      const debt = Math.abs(d.debt || 0);
      const rcTotal = Object.values(d.remainingBottles || {}).reduce((a, b) => a + b, 0);
      const hasActiveTruck = trucks.find(t => String(t.driverId) === String(driverId) && t.isActive);
      if (debt > 0) return { allowed: false, reason: "Dette en cours" };
      if (rcTotal > 0) return { allowed: false, reason: "Bouteilles R.C non restituées" };
      if (hasActiveTruck) return { allowed: false, reason: "Assoccié à un camion actif" };
      return { allowed: true };
    };
  
    const deleteDriver = async (id: string) => {
      const check = canDeleteDriver(id);
      if (!check.allowed) {
        return;
      }
      const success = await supabaseService.delete("drivers", String(id));
      if (success) {
        setDrivers(prev => prev.filter(d => String(d.id) !== String(id)));
      }
    };
  
    
  
    // Ensure all drivers have unique string ids (fixes React key warnings)
    React.useEffect(() => {
      setDrivers(prev => {
        let changed = false;
        const seen = new Set<string>();
        const next = prev.map(d => {
          let id = d.id ? String(d.id) : (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
          if (seen.has(id)) {
            id = (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
            changed = true;
          }
          seen.add(id);
          if (!d.id || d.id !== id) changed = true;
          return { ...d, id };
        });
        return changed ? next : prev;
      });
    }, []);

    // Ensure all clients have unique string ids
    React.useEffect(() => {
      setClients(prev => {
        let changed = false;
        const seen = new Set<string>();
        const next = prev.map(c => {
          let id = c.id ? String(c.id) : (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
          if (seen.has(id)) {
            id = (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
            changed = true;
          }
          seen.add(id);
          if (!c.id || c.id !== id) changed = true;
          return { ...c, id };
        });
        return changed ? next : prev;
      });
    }, []);
  
    // Update a driver's debt and recompute balance
    const updateDriverDebt = async (driverId: string, delta: number) => {
      const driver = drivers.find(d => String(d.id) === String(driverId));
      if (driver) {
        const nextDebt = Math.max(0, (driver.debt || 0) + delta);
        const nextBalance = (driver.advances || 0) - nextDebt;
        
        await addTransaction({
          date: new Date().toISOString(),
          type: delta > 0 ? 'debt' : 'payment',
          amount: Math.abs(delta),
          driverId: driverId,
          description: delta > 0 ? `Augmentation de la dette de ${delta} DH.` : `Réduction de la dette de ${Math.abs(delta)} DH.`,
        });

        const updated = await supabaseService.update<Driver>("drivers", driverId, { debt: nextDebt, balance: nextBalance });
        if (updated) {
          setDrivers(prev => prev.map(d => String(d.id) === String(driverId) ? updated : d));
        }
      }
    };
  
    // New : enregistrer le paiement — l'excédent devient une avance
    const recordDriverPayment = async (driverId: string, amount: number) => {
      const driver = drivers.find(d => String(d.id) === String(driverId));
      if (driver) {
        const currentDebt = driver.debt || 0;
        const currentAdvances = driver.advances || 0;

        let nextDebt: number;
        let nextAdvances: number;
        let description = "";

        if (amount <= currentDebt) {
          // Payment is less than or equal to debt
          nextDebt = currentDebt - amount;
          nextAdvances = currentAdvances;
          description = `Paiement de ${amount} DH sur la dette.`;
        } else {
          // Payment covers debt and adds to advances
          const debtPaid = currentDebt;
          const advance = amount - currentDebt;
          nextDebt = 0;
          nextAdvances = currentAdvances + advance;
          description = `Paiement de la dette (${debtPaid} DH) et ajout d'une avance (${advance} DH).`;
        }

        await addTransaction({
          date: new Date().toISOString(),
          type: 'payment',
          amount: amount,
          driverId: driverId,
          description: description,
        });

        const nextBalance = nextAdvances - nextDebt;
        const updated = await supabaseService.update<Driver>("drivers", driverId, { 
          debt: nextDebt, 
          advances: nextAdvances, 
          balance: nextBalance 
        });
        if (updated) {
          setDrivers(prev => prev.map(d => String(d.id) === String(driverId) ? updated : d));
        }
      }
    };
  
    // Sanitize trucks: ensure unique string ids
    React.useEffect(() => {
      setTrucks(prev => {
        let changed = false;
        const seen = new Set<string>();
        const next = prev.map(t => {
          let id = t.id ? String(t.id) : (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
          if (seen.has(id)) {
            id = (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
            changed = true;
          }
          seen.add(id);
          if (!t.id || t.id !== id) changed = true;
          return { ...t, id };
        });
        return changed ? next : prev;
      });
    }, []);
  
    // Ensure default 'petit-camion' trucks exist
    React.useEffect(() => {
      setTrucks(prev => {
        if (prev.some(t => t.truckType === 'petit-camion')) return prev;
        const alreadyAdded = window.localStorage.getItem('petitCamionDefaultsAdded');
        if (alreadyAdded === 'true') return prev;
        window.localStorage.setItem('petitCamionDefaultsAdded', 'true');
        return [
          ...prev,
          { id: 'a1', matricule: 'AL-1001', driverId: '', isActive: true, currentLoad: [], truckType: 'petit-camion' },
          { id: 'a2', matricule: 'AL-1002', driverId: '', isActive: true, currentLoad: [], truckType: 'petit-camion' },
        ];
      });
    }, []);
    const addTruck = async (truck: Truck) => {
      const id = truck.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newTruck = { ...truck, id };
      const created = await supabaseService.create<Truck>("trucks", newTruck);
      if (created) {
        setTrucks(prev => [...prev, created]);
      }
    };
    const deleteTruck = async (id: string) => {
      const success = await supabaseService.delete("trucks", id);
      if (success) {
        setTrucks(prev => prev.filter(t => t.id !== id));
        setTruckAssignments(prev => prev.filter((a: any) => a?.truckId !== id));
      }
    };
    const clearAllTrucks = async () => {
      // For now, clear local state. Bulk delete might be needed later.
      setTrucks([]);
      setTruckAssignments([]);
    };
    const addSupply = async (supply: Supply) => {
      const created = await supabaseService.create<Supply>("supplies", supply);
      if (created) {
        setSupplies((prev) => [...prev, created]);
      }
    };
    const addSupplyReturn = async (supplyReturn: SupplyReturn) => {
      const created = await supabaseService.create<SupplyReturn>("supply_returns", supplyReturn);
      if (created) {
        setSupplyReturns((prev) => [...prev, created]);
      }
    };
  
    // Harmonisation : s'assurer que chaque SupplyOrder a un id unique lors du chargement
    React.useEffect(() => {
      setSupplyOrders(prev => {
        let changed = false;
        const seen = new Set<string>();
        const next = prev.map(o => {
          let id = o.id ? String(o.id) : (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
          if (seen.has(id)) {
            id = (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
            changed = true;
          }
          seen.add(id);
          if (!o.id || o.id !== id) changed = true;
          return { ...o, id };
        });
        return changed ? next : prev;
      });
    }, []);
  
    const addSupplyOrder = async (order: any) => {
      const id = order.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      const newOrder = { ...order, id };
      const created = await supabaseService.create<any>("supply_orders", newOrder);
      if (created) {
        setSupplyOrders(prev => [...prev, created]);
      }
    };
    const updateSupplyOrder = async (updatedOrder: any) => {
      const updated = await supabaseService.update<any>("supply_orders", updatedOrder.id, updatedOrder);
      if (updated) {
        setSupplyOrders(prev => prev.map(order => order.id === updated.id ? updated : order));
      }
    };
    const deleteSupplyOrder = async (id: string) => {
      const success = await supabaseService.delete("supply_orders", id);
      if (success) {
        setSupplyOrders(prev => prev.filter(order => order.id !== id));
      }
    };
  
  // Create a new return order and update driver’s debt/balance
  const addReturnOrder = async (
    supplyOrderId: string,
    items: any[],
    totalVentes: number,
    totalExpenses: number,
    totalRC: number,
    amountPaid: number,
    driverId: string,
    driverDebtChange: number,
    creditChange: number,
    note: string,
    orderNumber?: string,
    paymentCash?: number,
    paymentCheque?: number,
    paymentMygaz?: number,
    paymentDebt?: number,
    paymentTotal?: number
  ): Promise<string> => {
    const id = `ret-${Date.now()}`;
    const supplyOrder = supplyOrders.find(o => o.id === supplyOrderId);
  
    const newReturnOrder: any = {
      id,
      orderNumber: orderNumber || `BD-${Date.now().toString().slice(-5)}`,
      date: new Date().toISOString(),
      supplyOrderId,
      supplyOrderNumber: supplyOrder?.orderNumber || '',
      driverId,
      driverName: drivers.find(d => String(d.id) === String(driverId))?.name,
      clientId: supplyOrder?.clientId,
      clientName: supplyOrder?.clientName,
      items,
      totalVentes,
      totalExpenses,
      totalRC,
      amountPaid,
      note,
      paymentCash,
      paymentCheque,
      paymentMygaz,
      paymentDebt,
      paymentTotal,
      isPaid: true,
      paidAt: new Date().toISOString(),
    };

    const created = await supabaseService.create<any>("return_orders", newReturnOrder);
    if (created) {
      setReturnOrders(prev => [...prev, created]);
    }

    // Update driver debt, balance AND remaining bottles
    const remainingBottlesUpdate: Record<string, number> = {};
    items.forEach((item: any) => {
      if (item.lostQuantity > 0) {
        remainingBottlesUpdate[item.bottleTypeId] = item.lostQuantity;
      }
    });

    await updateDriver(driverId, { 
      debt: driverDebtChange, 
      balance: creditChange,
      remainingBottles: remainingBottlesUpdate 
    });

    // Enregistrer la transaction dans l'historique du chauffeur
    if (driverDebtChange !== 0) {
      await addTransaction({
        date: new Date().toISOString(),
        type: driverDebtChange > 0 ? 'debt' : 'payment',
        amount: Math.abs(driverDebtChange),
        driverId: driverId,
        description: `B.D ${orderNumber || id} : Dette restante de ${driverDebtChange} DH.`,
      });
    }

    

    return id;
  };
  
  const deleteReturnOrder = async (id: string) => {
    const success = await supabaseService.delete("return_orders", id);
    if (success) {
      setReturnOrders(prev => prev.filter(order => order.id !== id));
    }
  };
  
  // Cash operations helpers
  const addCashOperation = async (operation: CashOperation) => {
    const id = operation.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const opName = operation.name || (operation as any).description || 'Opération';
    const accountAffected = normalizeAccount(operation.accountAffected);
    const newOp = { ...operation, id, name: opName, accountAffected };
    if (!navigator.onLine) {
      try {
        const { enqueueCash } = await import("@/lib/offlineQueue");
        enqueueCash(newOp);
        setCashOperations(prev => [...prev, newOp]);
        return;
      } catch {}
    }
    const created = await supabaseService.create<CashOperation>("cash_operations", newOp);
    setCashOperations(prev => [...prev, created || newOp]);
    await addFinancialTransaction({
      id,
      date: operation.date,
      type: operation.type === 'versement' ? 'versement' : 'retrait',
      description: opName,
      amount: operation.type === 'versement' ? operation.amount : Math.abs(operation.amount) * -1,
      sourceAccount: operation.type === 'versement' ? 'autre' : accountAffected,
      destinationAccount: operation.type === 'versement' ? accountAffected : 'autre',
      accountDetails: operation.accountDetails,
      status: operation.status === 'validated' ? 'completed' : 'pending',
      createdAt: new Date().toISOString(),
    });
  };

  const updateCashOperation = async (id: string | number, patch: Partial<CashOperation>) => {
    const updated = await supabaseService.update<CashOperation>("cash_operations", String(id), patch);
    if (updated) {
      setCashOperations(prev => prev.map(op => (op.id === id ? updated : op)));
      
      // Update financial transaction if it exists
      const type = updated.type;
      const accountAffected = normalizeAccount(updated.accountAffected);
      const txUpdate = {
        date: updated.date,
        description: updated.name || (updated as any).description || 'Opération',
        amount: type === 'versement' ? updated.amount : -updated.amount,
        sourceAccount: type === 'versement' ? 'autre' : accountAffected,
        destinationAccount: type === 'versement' ? accountAffected : 'autre',
        accountDetails: updated.accountDetails,
      };
      await supabaseService.update<FinancialTransaction>("financial_transactions", String(id), txUpdate);
      setFinancialTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...txUpdate } : tx));
    }
  };

  const validateCashOperation = async (id: string | number, validatorName?: string) => {
    const patch = { status: 'validated' as const, validatedAt: new Date().toISOString(), validatedBy: validatorName };
    const updated = await supabaseService.update<CashOperation>("cash_operations", String(id), patch);
    if (updated) {
      setCashOperations(prev => prev.map(op => (op.id === id ? updated : op)));
      // Update financial transaction status
      await supabaseService.update<FinancialTransaction>("financial_transactions", String(id), { status: 'completed' });
      setFinancialTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status: 'completed' } : tx));
    }
  };

  const deleteCashOperation = async (id: string | number) => {
    const success = await supabaseService.delete("cash_operations", String(id));
    if (success) {
      setCashOperations(prev => prev.filter(op => op.id !== id));
      await deleteFinancialTransaction(String(id));
    }
  };

  // Financial transactions
  const addFinancialTransaction = async (tx: Omit<FinancialTransaction, 'id'> & { id?: string }) => {
    const id = tx.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newTx = { ...tx, id, sourceAccount: normalizeAccount(tx.sourceAccount) };
    const created = await supabaseService.create<FinancialTransaction>("financial_transactions", newTx);
    setFinancialTransactions(prev => [...prev, created || newTx]);
  };

  const deleteFinancialTransaction = async (id: string) => {
    const success = await supabaseService.delete("financial_transactions", id);
    if (success) {
      setFinancialTransactions(prev => prev.filter(tx => tx.id !== id));
      // Try to delete from other tables if relevant
      await Promise.all([
        supabaseService.delete("cash_operations", id),
        supabaseService.delete("bank_transfers", id),
        supabaseService.delete("expenses", id),
        supabaseService.delete("repairs", id),
      ]);
      setCashOperations(prev => prev.filter(op => op.id !== id));
      setBankTransfers(prev => prev.filter(bt => bt.id !== id));
      setExpenses(prev => prev.filter(e => e.id !== id));
      setRepairs(prev => prev.filter(r => r.id !== id));
    }
  };

  const addRevenue = async (rev: Revenue) => {
    const id = rev.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newRev = { ...rev, id };
    const created = await supabaseService.create<Revenue>("revenues", newRev);
    if (created) {
      setRevenues(prev => [...prev, created]);
    }
    const isSettlement = Boolean(rev.relatedOrderId);
    const txType = isSettlement ? 'encaissement' : 'versement';
    if (rev.cashAmount && rev.cashAmount > 0) {
      const desc = rev.description || (isSettlement ? 'Règlement (Espèce)' : 'Vente Directe (Espèce)');
      const dup = financialTransactions.some(tx => 
        tx.description === desc &&
        tx.amount === rev.cashAmount &&
        tx.destinationAccount === 'espece' &&
        Math.abs(new Date(tx.date).getTime() - new Date(rev.date).getTime()) < 60000
      );
      if (!dup)
      await addFinancialTransaction({
        date: rev.date,
        type: txType,
        description: desc,
        amount: rev.cashAmount,
        destinationAccount: 'espece',
        sourceAccount: 'autre',
        status: 'completed',
        createdAt: new Date().toISOString(),
      });
    }
    if (rev.checkAmount && rev.checkAmount > 0) {
      const desc = rev.description || (isSettlement ? 'Règlement (Chèque)' : 'Vente Directe (Chèque)');
      const dup = financialTransactions.some(tx => 
        tx.description === desc &&
        tx.amount === rev.checkAmount &&
        tx.destinationAccount === 'cheque' &&
        Math.abs(new Date(tx.date).getTime() - new Date(rev.date).getTime()) < 60000
      );
      if (!dup)
      await addFinancialTransaction({
        date: rev.date,
        type: txType,
        description: desc,
        amount: rev.checkAmount,
        destinationAccount: 'cheque',
        sourceAccount: 'autre',
        status: 'completed',
        createdAt: new Date().toISOString(),
      });
    }
    if (rev.mygazAmount && rev.mygazAmount > 0) {
      const desc = rev.description || (isSettlement ? 'Règlement (MyGaz)' : 'Vente Directe (MyGaz)');
      const dup = financialTransactions.some(tx => 
        tx.description === desc &&
        tx.amount === rev.mygazAmount &&
        tx.destinationAccount === 'autre' &&
        Math.abs(new Date(tx.date).getTime() - new Date(rev.date).getTime()) < 60000
      );
      if (!dup)
      await addFinancialTransaction({
        date: rev.date,
        type: txType,
        description: desc,
        amount: rev.mygazAmount,
        destinationAccount: 'autre',
        sourceAccount: 'autre',
        status: 'completed',
        createdAt: new Date().toISOString(),
      });
    }
  };

  const addBankTransfer = async (bt: BankTransfer) => {
    const id = bt.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newBt = { ...bt, id };
    if (!navigator.onLine) {
      try {
        const { enqueueTransfer } = await import("@/lib/offlineQueue");
        enqueueTransfer(newBt);
        setBankTransfers(prev => [...prev, newBt]);
        return;
      } catch {}
    }
    const created = await supabaseService.create<BankTransfer>("bank_transfers", newBt);
    setBankTransfers(prev => [...prev, created || newBt]);
    await addFinancialTransaction({
      id,
      date: newBt.date,
      type: 'transfert',
      description: newBt.description || (newBt.type === 'remise_cheques' ? 'Remise de chèques' : 'Transfert bancaire'),
      amount: newBt.amount,
      sourceAccount: newBt.sourceAccount,
      destinationAccount: newBt.destinationAccount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  };

  const updateBankTransfer = async (id: string, patch: Partial<BankTransfer>) => {
    const updated = await supabaseService.update<BankTransfer>("bank_transfers", id, patch);
    if (updated) {
      setBankTransfers(prev => prev.map(bt => (bt.id === id ? updated : bt)));
      const txUpdate = {
        date: updated.date,
        amount: updated.amount,
        description: updated.description,
        sourceAccount: updated.sourceAccount,
        destinationAccount: updated.destinationAccount,
      };
      await supabaseService.update<FinancialTransaction>("financial_transactions", id, txUpdate);
      setFinancialTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...txUpdate } : tx));
    }
  };

  const validateBankTransfer = async (id: string, validatorName?: string) => {
    const patch = { status: 'validated' as const, validatedAt: new Date().toISOString(), validatedBy: validatorName };
    const updated = await supabaseService.update<BankTransfer>("bank_transfers", id, patch);
    if (updated) {
      setBankTransfers(prev => prev.map(bt => (bt.id === id ? updated : bt)));
      await supabaseService.update<FinancialTransaction>("financial_transactions", id, { status: 'completed' });
      setFinancialTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status: 'completed' } : tx));
    }
  };

  const deleteBankTransfer = async (id: string) => {
    const success = await supabaseService.delete("bank_transfers", id);
    if (success) {
      setBankTransfers(prev => prev.filter(t => t.id !== id));
      await deleteFinancialTransaction(id);
    }
  };

  const addExpense = async (expense: Expense) => {
    const id = expense.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newExpense = { ...expense, id };
    const created = await supabaseService.create<Expense>("expenses", newExpense);
    if (created) {
      setExpenses(prev => [...prev, created]);
      await addFinancialTransaction({
        id,
        date: expense.date,
        type: 'dépense',
        description: `Dépense: ${expense.type} [${expense.code || 'N/A'}]${expense.note ? ' - ' + expense.note : ''}`,
        amount: -expense.amount,
        sourceAccount: normalizeAccount(expense.paymentMethod),
        destinationAccount: 'charge',
        status: 'completed',
        createdAt: new Date().toISOString(),
      });
    }
  };

  const updateExpense = async (id: string, patch: Partial<Expense>) => {
    const updated = await supabaseService.update<Expense>("expenses", id, patch);
    if (updated) {
      setExpenses(prev => prev.map(exp => (exp.id === id ? updated : exp)));
      const txUpdate = {
        date: updated.date,
        amount: -updated.amount,
        description: `Dépense: ${updated.type} [${updated.code || 'N/A'}]${updated.note ? ' - ' + updated.note : ''}`,
        sourceAccount: normalizeAccount(updated.paymentMethod),
      };
      await supabaseService.update<FinancialTransaction>("financial_transactions", id, txUpdate);
      setFinancialTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...txUpdate } : tx));
    }
  };

  const deleteExpense = async (expenseId: string) => {
    const success = await supabaseService.delete("expenses", expenseId);
    if (success) {
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      await deleteFinancialTransaction(expenseId);
    }
  };

  const addRepair = async (repair: Repair) => {
    const id = repair.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newRepair = { ...repair, id };
    const created = await supabaseService.create<Repair>("repairs", newRepair);
    if (created) {
      setRepairs(prev => [...prev, created]);
      if (repair.paidAmount > 0) {
        await addFinancialTransaction({
          id,
          date: repair.date,
          type: 'dépense',
          description: `Réparation: ${repair.remarks || repair.type}`,
          amount: -(Number(repair.paidAmount) || 0),
          sourceAccount: normalizeAccount(repair.paymentMethod),
          destinationAccount: 'reparation',
          status: 'completed',
          createdAt: new Date().toISOString(),
        });
      }
    }
  };

  const updateRepair = async (id: string, patch: Partial<Repair>) => {
    const updated = await supabaseService.update<Repair>("repairs", id, patch);
    if (updated) {
      setRepairs(prev => prev.map(r => (r.id === id ? updated : r)));
      const txUpdate = {
        date: updated.date,
        amount: -(Number(updated.paidAmount) || 0),
        description: updated.remarks ? `Réparation: ${updated.remarks}` : `Réparation: ${updated.type}`,
        sourceAccount: normalizeAccount(updated.paymentMethod),
      };
      await supabaseService.update<FinancialTransaction>("financial_transactions", id, txUpdate);
      setFinancialTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...txUpdate } : tx));
    }
  };

  const deleteRepair = async (id: string) => {
    const success = await supabaseService.delete("repairs", id);
    if (success) {
      setRepairs(prev => prev.filter(r => r.id !== id));
      await deleteFinancialTransaction(id);
    }
  };

  const addExchange = async (exchange: Exchange) => {
    const id = exchange.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newExchange = { ...exchange, id };
    const created = await supabaseService.create<Exchange>("exchanges", newExchange);
    if (created) {
      setExchanges(prev => [...prev, created]);
    }
  };

  const addEmptyStock = async (stock: EmptyBottlesStock) => {
    const id = stock.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newStock = { ...stock, id };
    const created = await supabaseService.create<EmptyBottlesStock>("empty_bottles_stock", newStock);
    if (created) {
      setEmptyBottlesStock(prev => [...prev, created]);
    }
  };

  const updateEmptyBottlesStock = async (id: string, patch: Partial<EmptyBottlesStock>) => {
    const updated = await supabaseService.update<EmptyBottlesStock>("empty_bottles_stock", id, patch);
    if (updated) {
      setEmptyBottlesStock(prev => prev.map(s => (s.id === id ? updated : s)));
    }
  };

  const addStockHistory = async (history: Omit<StockHistory, 'id'>) => {
    const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const newHistory = { 
      ...history, 
      id,
      bottleTypeId: history.bottleTypeId || 'unknown',
      bottleTypeName: history.bottleTypeName || 'Inconnu'
    };
    const created = await supabaseService.create<StockHistory>("stock_history", newHistory);
    const next = created || newHistory;
    setStockHistory(prev => [next, ...prev].slice(0, 1000));
  };

  const updateEmptyBottlesStockByBottleType = async (
    bottleTypeId: string, 
    delta: number, 
    customChangeType?: 'add' | 'remove' | 'return' | 'factory',
    customNote?: string,
    customMeta?: {
      truckId?: string;
      supplierId?: string;
      blReference?: string;
      driverId?: string;
      driverName?: string;
      operationId?: string;
    }
  ) => {
    if (!delta) return;
    const idx = emptyBottlesStock.findIndex(s => s.bottleTypeId === bottleTypeId);
    const bottleTypeName = bottleTypes.find(bt => bt.id === bottleTypeId)?.name || '';
    const now = new Date().toISOString();

    let previousQuantity = 0;
    let nextQuantity = 0;

    if (idx === -1) {
      nextQuantity = delta;
      const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const newStock = { id, bottleTypeId, bottleTypeName, quantity: nextQuantity, lastUpdated: now };
      const created = await supabaseService.create<EmptyBottlesStock>("empty_bottles_stock", newStock);
      if (created) {
        setEmptyBottlesStock(prev => [...prev, created]);
      }
    } else {
      const current = emptyBottlesStock[idx];
      previousQuantity = current.quantity || 0;
      nextQuantity = previousQuantity + delta;
      const updated = await supabaseService.update<EmptyBottlesStock>("empty_bottles_stock", current.id, { quantity: nextQuantity, lastUpdated: now });
      if (updated) {
        setEmptyBottlesStock(prev => prev.map(s => s.id === current.id ? updated : s));
      }
    }

    const type = customChangeType || (delta > 0 ? 'add' : 'remove');

    const noteParts: string[] = [];
    if (customMeta?.truckId) {
      const truckName = trucks.find(t => t.id === customMeta.truckId)?.name;
      noteParts.push(`Camion: ${truckName || customMeta.truckId}`);
    }
    if (customMeta?.supplierId) {
      const supplierName = suppliers.find(s => s.id === customMeta.supplierId)?.name;
      noteParts.push(`Fournisseur: ${supplierName || customMeta.supplierId}`);
    }
    if (customMeta?.driverName) {
      noteParts.push(`Chauffeur: ${customMeta.driverName}`);
    }
    if (customMeta?.blReference) {
      noteParts.push(`BL: ${customMeta.blReference}`);
    }
    if (customMeta?.operationId) {
      noteParts.push(`Opération: ${customMeta.operationId}`);
    }
    const baseNote = customNote || `Mise à jour automatique du stock vide`;
    const finalNote = noteParts.length ? `${baseNote} | ${noteParts.join(' | ')}` : baseNote;

    await addStockHistory({
      date: now,
      bottleTypeId,
      bottleTypeName,
      stockType: 'empty',
      changeType: customChangeType || (delta > 0 ? 'add' : 'remove'),
      quantity: Math.abs(delta),
      previousQuantity,
      newQuantity: nextQuantity,
      note: finalNote
    });
  };

  const addDefectiveStock = async (bottleTypeId: string, quantity: number) => {
    const bottleTypeName = bottleTypes.find(bt => bt.id === bottleTypeId)?.name || '';
    const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const now = new Date().toISOString();

    const previousQuantity = defectiveStock
      .filter(d => d.bottleTypeId === bottleTypeId)
      .reduce((sum, d) => sum + d.quantity, 0);

    const newDefective = {
      id,
      returnOrderId: 'manual',
      bottleTypeId: bottleTypeId || 'unknown',
      bottleTypeName: bottleTypeName || 'Inconnu',
      quantity,
      date: now,
    };
    const created = await supabaseService.create<DefectiveBottle>("defective_stock", newDefective);
    if (created) {
      setDefectiveStock(prev => [...prev, created]);
      await addStockHistory({
        date: now,
        bottleTypeId,
        bottleTypeName,
        stockType: 'defective',
        changeType: 'add',
        quantity,
        previousQuantity,
        newQuantity: previousQuantity + quantity,
        note: 'Ajout manuel de stock défectueux'
      });
    }
  };

  const addDefectiveBottle = async (bottle: DefectiveBottle) => {
    const id = bottle.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const now = new Date().toISOString();

    const previousQuantity = defectiveStock
      .filter(d => d.bottleTypeId === bottle.bottleTypeId)
      .reduce((sum, d) => sum + d.quantity, 0);

    const newBottle = { 
      ...bottle, 
      id, 
      date: bottle.date || now,
      bottleTypeId: bottle.bottleTypeId || 'unknown',
      bottleTypeName: bottle.bottleTypeName || 'Inconnu'
    };
    const created = await supabaseService.create<DefectiveBottle>("defective_stock", newBottle);
    if (created) {
      setDefectiveStock(prev => [...prev, created]);
      await addStockHistory({
        date: bottle.date || now,
        bottleTypeId: bottle.bottleTypeId,
        bottleTypeName: bottle.bottleTypeName,
        stockType: 'defective',
        changeType: 'add',
        quantity: bottle.quantity,
        previousQuantity,
        newQuantity: previousQuantity + bottle.quantity,
        note: 'Ajout de stock défectueux'
      });
    }
  };

  // جديد: تحديث مخزون القنينات المعيبة حسب نوع القنينة والفرق (delta)
  const updateDefectiveBottlesStock = async (bottleTypeId: string, delta: number) => {
    if (!delta) return;
    const now = new Date().toISOString();
    const bottleTypeName = bottleTypes.find(bt => bt.id === bottleTypeId)?.name || '';

    // Calculate previous quantity for history
    const previousQuantity = defectiveStock
      .filter(d => d.bottleTypeId === bottleTypeId)
      .reduce((sum, d) => sum + d.quantity, 0);

    if (delta > 0) {
      // زيادة المخزون: نسجل إدخالاً جديداً
      const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const newDefective = {
        id,
        returnOrderId: 'factory',
        bottleTypeId: bottleTypeId || 'unknown',
        bottleTypeName: bottleTypeName || 'Inconnu',
        quantity: delta,
        date: now,
      };
      const created = await supabaseService.create<DefectiveBottle>("defective_stock", newDefective);
      if (created) {
        setDefectiveStock(prev => [...prev, created]);
      }
    } else {
      // نقص المخزون (مثلاً عند إرساله للمصنع للإصلاح): نخصم من الإدخالات القديمة
      let remainingToSubtract = Math.abs(delta);
      const relevantEntries = defectiveStock
        .filter(d => d.bottleTypeId === bottleTypeId && d.quantity > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const entry of relevantEntries) {
        if (remainingToSubtract <= 0) break;
        const subtractFromThis = Math.min(entry.quantity, remainingToSubtract);
        remainingToSubtract -= subtractFromThis;
        
        if (entry.quantity === subtractFromThis) {
          const success = await supabaseService.delete("defective_stock", entry.id);
          if (success) {
            setDefectiveStock(prev => prev.filter(d => d.id !== entry.id));
          }
        } else {
          const updated = await supabaseService.update<DefectiveBottle>("defective_stock", entry.id, { quantity: entry.quantity - subtractFromThis });
          if (updated) {
            setDefectiveStock(prev => prev.map(d => d.id === entry.id ? updated : d));
          }
        }
      }

      // If there's still something to subtract, create a negative entry
      if (remainingToSubtract > 0) {
        const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const negativeEntry = {
          id,
          returnOrderId: 'factory_negative',
          bottleTypeId: bottleTypeId || 'unknown',
          bottleTypeName: bottleTypeName || 'Inconnu',
          quantity: -remainingToSubtract,
          date: now,
        };
        const created = await supabaseService.create<DefectiveBottle>("defective_stock", negativeEntry);
        if (created) {
          setDefectiveStock(prev => [...prev, created]);
        }
      }
    }

    await addStockHistory({
      date: now,
      bottleTypeId,
      bottleTypeName,
      stockType: 'defective',
      changeType: delta > 0 ? 'add' : 'remove',
      quantity: Math.abs(delta),
      previousQuantity,
      newQuantity: Math.max(0, previousQuantity + delta),
      note: delta > 0 ? 'Ajout de stock défectueux' : 'Sortie de stock défectueux'
    });
  };
  const updateInventory = async (id: string, patch: Partial<Inventory>) => {
    const updated = await supabaseService.update<Inventory>("inventory", id, patch);
    if (updated) {
      setInventory(prev => prev.map(inv => (inv.id === id ? updated : inv)));
    }
  };

  const clearAllInventory = async () => {
    // 1. Reset empty bottles stock quantities to 0
    const now = new Date().toISOString();
    await Promise.all(emptyBottlesStock.map(s => 
      supabaseService.update<EmptyBottlesStock>("empty_bottles_stock", s.id, { quantity: 0, lastUpdated: now })
    ));
    setEmptyBottlesStock(prev => prev.map(s => ({ ...s, quantity: 0, lastUpdated: now })));
    
    // 2. Clear defective stock entries
    await Promise.all(defectiveStock.map(d => supabaseService.delete("defective_stock", d.id)));
    setDefectiveStock([]);
    
    // 3. Reset bottle types (full stock quantities)
    // We want to keep the standard types mentioned by the user
    const standardTypes = [
      { name: 'Butane 12KG', capacity: '12KG' },
      { name: 'Butane 6KG', capacity: '6KG' },
      { name: 'Butane 3KG', capacity: '3KG' },
      { name: 'BNG 12KG', capacity: '12KG' },
      { name: 'Propane 34KG', capacity: '34KG' },
      { name: 'Détendeur Clic-On', capacity: 'Standard' }
    ];

    const nextBottleTypes = [...bottleTypes];
    for (let bt of nextBottleTypes) {
      await supabaseService.update<BottleType>("bottle_types", bt.id, {
        distributedQuantity: 0,
        remainingQuantity: bt.totalQuantity,
        lastUpdated: now
      });
    }

    setBottleTypes(prev => prev.map(bt => ({
      ...bt,
      distributedQuantity: 0,
      remainingQuantity: bt.totalQuantity,
      lastUpdated: now
    })));

    // Ensure standard types exist in Supabase
    for (const st of standardTypes) {
      const exists = bottleTypes.find(bt => bt.name.toLowerCase() === st.name.toLowerCase());
      if (!exists) {
        const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const newBt: BottleType = {
          id,
          name: st.name,
          capacity: st.capacity,
          totalQuantity: 0,
          distributedQuantity: 0,
          remainingQuantity: 0,
          unitPrice: 0,
          taxRate: 20,
          purchasePrice: st.capacity === '12KG' ? 41.76 : st.capacity === '6KG' ? 20.88 : st.capacity === '3KG' ? 10.15 : st.capacity === '34KG' ? 0 : 0
        };
        const created = await supabaseService.create<BottleType>("bottle_types", newBt);
        if (created) {
          setBottleTypes(prev => [...prev, created]);
        }
      }
    }

    // 4. Clear foreign bottles stock
    await Promise.all(foreignBottles.map(fb => supabaseService.delete("foreign_bottles", fb.id)));
    setForeignBottles([]);

    // 5. Add a history entry
    await addStockHistory({
      date: now,
      bottleTypeId: 'all',
      bottleTypeName: 'Tout le Stock',
      stockType: 'all',
      changeType: 'remove',
      quantity: 0,
      previousQuantity: 0,
      newQuantity: 0,
      note: 'Réinitialisation complète de l\'inventaire (Types standards conservés)'
    });
  };

  const addFuelPurchase = async (purchase: FuelPurchase) => {
    const id = purchase.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newPurchase = { ...purchase, id };
    const created = await supabaseService.create<FuelPurchase>("fuel_purchases", newPurchase);
    if (created) {
      setFuelPurchases(prev => [...prev, created]);
    }
  };
  const addFuelConsumption = async (consumption: FuelConsumption) => {
    const id = consumption.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newConsumption = { ...consumption, id };
    const created = await supabaseService.create<FuelConsumption>("fuel_consumptions", newConsumption);
    if (created) {
      setFuelConsumptions(prev => [...prev, created]);
    }
  };
  const addFuelDrain = async (drain: FuelDrain) => {
    const id = drain.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newDrain = { ...drain, id };
    const created = await supabaseService.create<FuelDrain>("fuel_drains", newDrain);
    if (created) {
      setFuelDrains(prev => [...prev, created]);
    }
  };
  const addOilPurchase = async (purchase: OilPurchase) => {
    const id = purchase.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newPurchase = { ...purchase, id };
    const created = await supabaseService.create<OilPurchase>("oil_purchases", newPurchase);
    if (created) {
      setOilPurchases(prev => [...prev, created]);
    }
  };
  const addOilConsumption = async (consumption: OilConsumption) => {
    const id = consumption.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newConsumption = { ...consumption, id };
    const created = await supabaseService.create<OilConsumption>("oil_consumptions", newConsumption);
    if (created) {
      setOilConsumptions(prev => [...prev, created]);
    }
  };
  const addOilDrain = async (drain: OilDrain) => {
    const id = drain.id ?? (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newDrain = { ...drain, id };
    const created = await supabaseService.create<OilDrain>("oil_drains", newDrain);
    if (created) {
      setOilDrains(prev => [...prev, created]);
    }
  };
  

  const getAccountBalance = (account: 'espece' | 'cheque' | 'banque' | 'autre') => {
    // Calculer الرصيد مباشرة من financialTransactions
    const relevant = financialTransactions.filter(
      (t) => (t.status === 'pending' || t.status === 'completed') && (t.sourceAccount === account || t.destinationAccount === account)
    );
    return relevant.reduce((sum, t) => {
      let s = sum;
      const amt = Math.abs(Number(t.amount) || 0);
      if (t.destinationAccount === account) s += amt;
      if (t.sourceAccount === account) s -= amt;
      return s;
    }, 0);
  };
  
  // Misc updates
  const addBottleType = async (bottle: BottleType) => {
    const id = bottle.id || (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newBottleType = { ...bottle, id };
    let created = await supabaseService.create<BottleType>("bottle_types", newBottleType);
    if (!created && Object.prototype.hasOwnProperty.call(newBottleType, "color")) {
      const fallbackPayload = { ...newBottleType } as any;
      delete fallbackPayload.color;
      created = await supabaseService.create<BottleType>("bottle_types", fallbackPayload);
    }
    if (created) {
      const merged = { ...newBottleType, ...created };
      setBottleTypes(prev => [...prev, merged]);
      return merged;
    }
    return null;
  };
  const updateBottleType = async (id: string, patch: Partial<BottleType>) => {
    let updated = await supabaseService.update<BottleType>("bottle_types", id, patch);
    if (!updated && Object.prototype.hasOwnProperty.call(patch, "color")) {
      const fallbackPatch = { ...patch } as any;
      delete fallbackPatch.color;
      updated = await supabaseService.update<BottleType>("bottle_types", id, fallbackPatch);
    }
    if (updated) {
      const merged = { id, ...updated, ...patch };
      setBottleTypes(prev => prev.map(b => (b.id === id ? { ...b, ...merged } : b)));
      return merged;
    }
    setBottleTypes(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
    return { id, ...(patch as any) } as BottleType;
  };
  const deleteBottleType = async (id: string) => {
    const success = await supabaseService.delete("bottle_types", id);
    if (success) {
      setBottleTypes(prev => prev.filter(b => b.id !== id));
      // Also cleanup empty bottles stock if exists
      const emptyStock = emptyBottlesStock.find(s => s.bottleTypeId === id);
      if (emptyStock) {
        await supabaseService.delete("empty_bottles_stock", emptyStock.id);
        setEmptyBottlesStock(prev => prev.filter(s => s.id !== emptyStock.id));
      }
    }
  };
  const addTransaction = async (transaction: any) => {
    const id = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const newTransaction = {
      ...transaction,
      id,
      montant: transaction?.montant ?? transaction?.amount,
      libelle: transaction?.libelle ?? transaction?.description,
      avance: transaction?.avance ?? transaction?.advances,
      totalvalue: transaction?.totalvalue ?? transaction?.totalValue,
      totalventes: transaction?.totalventes ?? transaction?.totalVentes,
    };
    const created = await supabaseService.create<any>("transactions", newTransaction);
    const merged = created
      ? {
          ...newTransaction,
          ...created,
          amount: created?.amount ?? newTransaction.amount,
          description: created?.description ?? newTransaction.description,
        }
      : newTransaction;
    setTransactions(prev => [...prev, merged]);
  };
  const updateDriver = async (driverId: string, updates: Partial<Driver>) => {
    const d = drivers.find(drv => String(drv.id) === String(driverId));
    if (!d) return;

    const newDebt = updates.debt !== undefined ? (d.debt || 0) + updates.debt : d.debt;
    const newBalance = updates.balance !== undefined ? (d.balance || 0) + updates.balance : d.balance;
    const newAdvances = updates.advances !== undefined ? (d.advances || 0) + updates.advances : d.advances;
    
    // Merge or override remaining bottles
    let newRemainingBottles = { ...(d.remainingBottles || {}) };
    let nextRcHistory = d.rcHistory || [];
    let nextLastRCUpdate = d.lastRCUpdate;
    if (updates.remainingBottles) {
      if ((updates.remainingBottles as any)._isOverride) {
        const { _isOverride, ...actualBottles } = updates.remainingBottles as any;
        const prevBottles = d.remainingBottles || {};
        const keys = Array.from(new Set([...Object.keys(prevBottles), ...Object.keys(actualBottles)]));
        const changes = keys.reduce<Array<{ bottleTypeId: string; bottleTypeName?: string; previousQty: number; newQty: number; diff: number }>>((arr, id) => {
          const previousQty = prevBottles[id] || 0;
          const newQty = (actualBottles as any)[id] || 0;
          if (previousQty !== newQty) {
            const name = bottleTypes.find(b => String(b.id) === String(id))?.name;
            arr.push({
              bottleTypeId: id,
              bottleTypeName: name,
              previousQty,
              newQty,
              diff: newQty - previousQty,
            });
          }
          return arr;
        }, []);
        if (changes.length > 0) {
          const historyDate = updates.lastRCUpdate || new Date().toISOString();
          nextRcHistory = [...nextRcHistory, { date: historyDate, changes }];
          nextLastRCUpdate = historyDate;
        }
        newRemainingBottles = actualBottles;
      } else {
        Object.entries(updates.remainingBottles as Record<string, number>).forEach(([id, qty]) => {
          newRemainingBottles[id] = (newRemainingBottles[id] || 0) + (qty || 0);
        });
      }
    }

    const updatedData = { 
      ...updates, 
      debt: newDebt, 
      balance: newBalance, 
      advances: newAdvances,
      remainingBottles: newRemainingBottles,
      rcHistory: nextRcHistory,
      lastRCUpdate: nextLastRCUpdate
    };

    if (updates.debtThreshold !== undefined) {
      const normalizedThreshold = Math.max(0, Number(updates.debtThreshold) || 0);
      setDriverDebtThresholds(prev => ({ ...prev, [String(driverId)]: normalizedThreshold }));
      updatedData.debtThreshold = normalizedThreshold;
    }
    if (updates.foreignBottlesThreshold !== undefined) {
      const normalizedForeignThreshold = Math.max(0, Number(updates.foreignBottlesThreshold) || 0);
      setDriverForeignThresholds(prev => ({ ...prev, [String(driverId)]: normalizedForeignThreshold }));
      updatedData.foreignBottlesThreshold = normalizedForeignThreshold;
    }

    const updated = await supabaseService.update<Driver>("drivers", driverId, updatedData);
    if (updated) {
      const localThreshold = updatedData.debtThreshold !== undefined
        ? Number(updatedData.debtThreshold)
        : Number(driverDebtThresholds[String(driverId)] ?? d.debtThreshold ?? 0);
      const localForeignThreshold = updatedData.foreignBottlesThreshold !== undefined
        ? Number(updatedData.foreignBottlesThreshold)
        : Number(driverForeignThresholds[String(driverId)] ?? d.foreignBottlesThreshold ?? 0);
      setDrivers(prev => prev.map(drv => (
        String(drv.id) === String(driverId)
          ? { ...updated, debtThreshold: localThreshold, foreignBottlesThreshold: localForeignThreshold }
          : drv
      )));
    }
  };
  const addForeignBottle = async (foreignBottle: ForeignBottle) => {
    const id = foreignBottle.id || (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const newBottle = { ...foreignBottle, id };
    const created = await supabaseService.create<ForeignBottle>("foreign_bottles", newBottle);
    if (created) {
      setForeignBottles(prev => [...prev, created]);
    }
  };

  // Truck management
  const updateTruck = async (id: string, patch: Partial<Truck>) => {
    const current = trucks.find(t => t.id === id);
    if (!current) return;

    const nextDriverId = patch.driverId !== undefined ? patch.driverId : current?.driverId;

    if (nextDriverId !== undefined && nextDriverId !== current.driverId) {
      // Create assignment record
      const assignment = {
        id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
        truckId: id,
        prevDriverId: current.driverId || "",
        driverId: nextDriverId || "",
        date: new Date().toISOString(),
        note: patch.isActive === false ? "Mise en repos auto" : undefined,
      };
      
      const created = await supabaseService.create<any>("truck_assignments", assignment);
      if (created) {
        setTruckAssignments(assigns => [...assigns, created]);
      }
    }

    const updated = await supabaseService.update<Truck>("trucks", id, { 
      ...patch, 
      updatedAt: new Date().toISOString() 
    });
    if (updated) {
      setTrucks(prev => prev.map(t => t.id === id ? updated : t));
    }
  };
  const bulkSetRepos = async (ids: string[], reposReason?: string, nextReturnDate?: string) => {
    // Ideally use a bulk update in supabaseService
    await Promise.all(ids.map(id => 
      supabaseService.update<Truck>("trucks", id, { 
        isActive: false, 
        reposReason, 
        nextReturnDate, 
        updatedAt: new Date().toISOString() 
      })
    ));
    
    // Refresh local state (or refetch)
    const trucksData = await supabaseService.getAll<Truck>("trucks");
    setTrucks(trucksData);
  };
  const bulkReactivate = async (ids: string[]) => {
    await Promise.all(ids.map(id => 
      supabaseService.update<Truck>("trucks", id, { 
        isActive: true, 
        reposReason: undefined, 
        nextReturnDate: undefined, 
        updatedAt: new Date().toISOString() 
      })
    ));
    const trucksData = await supabaseService.getAll<Truck>("trucks");
    setTrucks(trucksData);
  };
  const bulkDissociateDriver = async (ids: string[]) => {
    // Create assignments
    const newAssignments = ids.map(id => ({
      id: window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      truckId: id,
      prevDriverId: trucks.find(t => t.id === id)?.driverId || "",
      driverId: "",
      date: new Date().toISOString(),
      note: "Dissocié",
    }));
    
    for (const assignment of newAssignments) {
      const created = await supabaseService.create<any>("truck_assignments", assignment);
      if (created) {
        setTruckAssignments(assigns => [...assigns, created]);
      }
    }

    await Promise.all(ids.map(id => 
      supabaseService.update<Truck>("trucks", id, { 
        driverId: undefined, 
        updatedAt: new Date().toISOString() 
      })
    ));
    const trucksData = await supabaseService.getAll<Truck>("trucks");
    setTrucks(trucksData);
  };
  const driverHasActiveTruck = (driverId: string) => trucks.find(t => t.driverId === driverId && t.isActive);

  const driversWithTransactions = React.useMemo(() => {
    const totalForeignByDriver: Record<string, number> = {};
    (returnOrders || []).forEach((order: any) => {
      const driverId = String(order?.driverId ?? '');
      if (!driverId) return;
      const foreignTotal = (order?.items || []).reduce((sum: number, item: any) => sum + (Number(item?.foreignQuantity || 0) || 0), 0);
      totalForeignByDriver[driverId] = (totalForeignByDriver[driverId] || 0) + foreignTotal;
    });
    return drivers.map(driver => ({
      ...driver,
      debtThreshold: Number(driver.debtThreshold ?? driverDebtThresholds[String(driver.id)] ?? 0),
      foreignBottlesThreshold: Number(driver.foreignBottlesThreshold ?? driverForeignThresholds[String(driver.id)] ?? 0),
      totalForeignBottles: Number(totalForeignByDriver[String(driver.id)] || 0),
      isClosedDueDebt:
        Number(driver.debtThreshold ?? driverDebtThresholds[String(driver.id)] ?? 0) > 0 &&
        Number(driver.debt || 0) >= Number(driver.debtThreshold ?? driverDebtThresholds[String(driver.id)] ?? 0),
      isClosedDueForeign:
        Number(driver.foreignBottlesThreshold ?? driverForeignThresholds[String(driver.id)] ?? 0) > 0 &&
        Number(totalForeignByDriver[String(driver.id)] || 0) >= Number(driver.foreignBottlesThreshold ?? driverForeignThresholds[String(driver.id)] ?? 0),
      isUnavailable:
        (
          Number(driver.debtThreshold ?? driverDebtThresholds[String(driver.id)] ?? 0) > 0 &&
          Number(driver.debt || 0) >= Number(driver.debtThreshold ?? driverDebtThresholds[String(driver.id)] ?? 0)
        ) ||
        (
          Number(driver.foreignBottlesThreshold ?? driverForeignThresholds[String(driver.id)] ?? 0) > 0 &&
          Number(totalForeignByDriver[String(driver.id)] || 0) >= Number(driver.foreignBottlesThreshold ?? driverForeignThresholds[String(driver.id)] ?? 0)
        ),
      transactions: transactions.filter(t => String(t.driverId) === String(driver.id))
    }));
  }, [drivers, transactions, driverDebtThresholds, driverForeignThresholds, returnOrders]);
  
  const value = {
    clients,
    addClient,
    updateClient,
    deleteClient,
    brands,
    addBrand,
    drivers: driversWithTransactions,
    addDriver,
    updateDriver,
    updateDriverDebt,
    recordDriverPayment,
    deleteDriver,
    canDeleteDriver,
    updateBrand,
    deleteBrand,
    trucks,
    addTruck,
    updateTruck,
    deleteTruck,
    clearAllTrucks,
    bulkSetRepos,
    bulkReactivate,
    bulkDissociateDriver,
    driverHasActiveTruck,
    truckAssignments,
    supplies,
    addSupply,
    supplyReturns,
    addSupplyReturn,
    supplyOrders,
    addSupplyOrder,
    updateSupplyOrder,
    deleteSupplyOrder,
    returnOrders,
    addReturnOrder,
    deleteReturnOrder,
    cashOperations,
    addCashOperation,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    repairs,
    addRepair,
    updateRepair,
    deleteRepair,
    exchanges,
    addExchange,
    emptyBottlesStock,
    addEmptyStock,
    updateEmptyBottlesStock,
    updateEmptyBottlesStockByBottleType,
    defectiveStock,
    defectiveBottles: defectiveStock,
    addDefectiveStock,
    addDefectiveBottle,
    updateDefectiveBottlesStock,
    inventory,
    updateInventory,
    clearAllInventory,
    fuelPurchases,
    addFuelPurchase,
    fuelConsumptions,
    addFuelConsumption,
    fuelDrains,
    addFuelDrain,
    oilPurchases,
    addOilPurchase,
    oilConsumptions,
    addOilConsumption,
    oilDrains,
    addOilDrain,
    revenues,
    addRevenue,
    bankTransfers,
    addBankTransfer,
    updateBankTransfer,
    validateBankTransfer,
    deleteBankTransfer,
    financialTransactions,
    addFinancialTransaction,
    deleteFinancialTransaction,
    updateCashOperation,
    validateCashOperation,
    deleteCashOperation,
    getAccountBalance,
    bottleTypes,
    addBottleType,
    updateBottleType,
    deleteBottleType,
    transactions,
    addTransaction,
    foreignBottles,
    addForeignBottle,
    stockHistory,
    addStockHistory,
    suppliers: suppliers.map(s => ({
      ...s,
      transactionCount: transactions.filter(t => t.type === 'factory' && t.supplierId === s.id).length
    })),
    addSupplier,
    updateSupplier,
    deleteSupplier,
    expenseTypes,
    addExpenseType,
    roles,
    roleAssignments,
    availablePermissions: permissionCatalog,
    currentUserEmail,
    currentRole,
    addRole,
    updateRolePermissions,
    assignRoleToEmail,
    removeRoleAssignment,
    hasPermission,
    exportData: () => {
      const data = {
        clients,
        brands,
        drivers,
        trucks,
        truckAssignments,
        supplies,
        supplyReturns,
        supplyOrders,
        returnOrders,
        cashOperations,
        expenses,
        repairs,
        exchanges,
        emptyBottlesStock,
        defectiveStock,
        bottleTypes,
        transactions,
        foreignBottles,
        inventory,
        fuelPurchases,
        fuelConsumptions,
        fuelDrains,
        oilPurchases,
        oilConsumptions,
        oilDrains,
        revenues,
        bankTransfers,
        financialTransactions,
        stockHistory,
        suppliers,
        roles,
        roleAssignments,
        exportDate: new Date().toISOString(),
        version: "1.0.0"
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_sft_gaz_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    importData: (jsonData: string) => {
      try {
        const data = JSON.parse(jsonData);
        
        if (data.clients) setClients(data.clients);
        if (data.brands) setBrands(data.brands);
        if (data.drivers) setDrivers(data.drivers);
        if (data.trucks) setTrucks(data.trucks);
        if (data.truckAssignments) setTruckAssignments(data.truckAssignments);
        if (data.supplies) setSupplies(data.supplies);
        if (data.supplyReturns) setSupplyReturns(data.supplyReturns);
        if (data.supplyOrders) setSupplyOrders(data.supplyOrders);
        if (data.returnOrders) setReturnOrders(data.returnOrders);
        if (data.cashOperations) setCashOperations(data.cashOperations);
        if (data.expenses) setExpenses(data.expenses);
        if (data.repairs) setRepairs(data.repairs);
        if (data.exchanges) setExchanges(data.exchanges);
        if (data.emptyBottlesStock) setEmptyBottlesStock(data.emptyBottlesStock);
        if (data.defectiveStock) setDefectiveStock(data.defectiveStock);
        if (data.bottleTypes) setBottleTypes(data.bottleTypes);
        if (data.transactions) setTransactions(data.transactions);
        if (data.foreignBottles) setForeignBottles(data.foreignBottles);
        if (data.inventory) setInventory(data.inventory);
        if (data.fuelPurchases) setFuelPurchases(data.fuelPurchases);
        if (data.fuelConsumptions) setFuelConsumptions(data.fuelConsumptions);
        if (data.fuelDrains) setFuelDrains(data.fuelDrains);
        if (data.oilPurchases) setOilPurchases(data.oilPurchases);
        if (data.oilConsumptions) setOilConsumptions(data.oilConsumptions);
        if (data.oilDrains) setOilDrains(data.oilDrains);
        if (data.revenues) setRevenues(data.revenues);
        if (data.bankTransfers) setBankTransfers(data.bankTransfers);
        if (data.financialTransactions) setFinancialTransactions(data.financialTransactions);
        if (data.stockHistory) setStockHistory(data.stockHistory);
        if (data.suppliers) setSuppliers(data.suppliers);
        if (data.roles) setRoles(data.roles);
        if (data.roleAssignments) setRoleAssignments(data.roleAssignments);

        alert("Données importées avec succès !");
        window.location.reload();
      } catch (error) {
        console.error("Error importing data:", error);
        alert("Erreur lors de l'importation des données. Veuillez vérifier le fichier.");
      }
    },
    clearAllData: () => {
      if (window.confirm("Êtes-vous sûr de vouloir supprimer TOUTES les données ? Cette action est irréversible.")) {
        localStorage.clear();
        window.location.reload();
      }
    },
  };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
  };
  
  export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
      throw new Error("useApp must be used within an AppProvider");
    }
    return context;
  }
