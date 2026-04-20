import { supabase } from "./supabaseClient";

const toSnakeKey = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const currentUserId = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
};
const hasUserIdColumnError = (message?: string) =>
  (message || '').toLowerCase().includes('user_id');
const toCamelKey = (key: string) => {
  const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const lower = camel.toLowerCase();
  // Heuristic for flat lowercase keys that should be camelCase
  if (lower === 'totalquantity') return 'totalQuantity';
  if (lower === 'remainingquantity') return 'remainingQuantity';
  if (lower === 'distributedquantity') return 'distributedQuantity';
  if (lower === 'unitprice') return 'unitPrice';
  if (lower === 'taxrate') return 'taxRate';
  if (lower === 'purchaseprice') return 'purchasePrice';
  if (lower === 'bottletypeid') return 'bottleTypeId';
  if (lower === 'bottletypename') return 'bottleTypeName';
  if (lower === 'orderid') return 'orderId';
  if (lower === 'ordertype') return 'orderType';
  if (lower === 'driverid') return 'driverId';
  if (lower === 'drivername') return 'driverName';
  if (lower === 'truckid') return 'truckId';
  if (lower === 'clientid') return 'clientId';
  if (lower === 'supplierid') return 'supplierId';
  if (lower === 'bankaccountname') return 'bankAccountName';
  if (lower === 'sentbottles') return 'sentBottles';
  if (lower === 'receivedbottles') return 'receivedBottles';
  if (lower === 'debtchange') return 'debtChange';
  if (lower === 'receiveddate') return 'receivedDate';
  if (lower === 'blreference') return 'blReference';
  if (lower === 'clientname') return 'clientName';
  if (lower === 'montant') return 'amount';
  if (lower === 'libelle') return 'description';
  if (lower === 'avance') return 'advances';
  if (lower === 'avances') return 'advances';
  if (lower === 'totalvalue') return 'totalValue';
  if (lower === 'totalventes') return 'totalVentes';
  // Financial & ops specific
  if (lower === 'accountaffected') return 'accountAffected';
  if (lower === 'accountdetails') return 'accountDetails';
  if (lower === 'validatedat') return 'validatedAt';
  if (lower === 'validatedby') return 'validatedBy';
  if (lower === 'sourceaccount') return 'sourceAccount';
  if (lower === 'destinationaccount') return 'destinationAccount';
  if (lower === 'createdat') return 'createdAt';
  // Stock history & defective/empty specific
  if (lower === 'returnorderid') return 'returnOrderId';
  if (lower === 'lastupdated') return 'lastUpdated';
  if (lower === 'stocktype') return 'stockType';
  if (lower === 'changetype') return 'changeType';
  if (lower === 'previousquantity') return 'previousQuantity';
  if (lower === 'newquantity') return 'newQuantity';
  return camel;
};
const toSnakeShallow = (value: Record<string, any>) =>
  Object.fromEntries(Object.entries(value).map(([key, val]) => [toSnakeKey(key), val]));
const toCamelShallow = (value: Record<string, any>) =>
  Object.fromEntries(Object.entries(value).map(([key, val]) => [toCamelKey(key), val]));
const columnMap: Record<string, Record<string, string>> = {
  cash_operations: {
    accountAffected: 'accountaffected',
    accountDetails: 'accountdetails',
    validatedAt: 'validatedat',
    validatedBy: 'validatedby',
  },
  financial_transactions: {
    sourceAccount: 'sourceaccount',
    destinationAccount: 'destinationaccount',
    accountDetails: 'accountdetails',
    createdAt: 'createdat',
  },
  empty_bottles_stock: {
    bottleTypeId: 'bottletypeid',
    bottleTypeName: 'bottletypename',
    lastUpdated: 'lastupdated',
  },
  defective_stock: {
    bottleTypeId: 'bottletypeid',
    bottleTypeName: 'bottletypename',
    returnOrderId: 'returnorderid',
  },
  stock_history: {
    bottleTypeId: 'bottletypeid',
    bottleTypeName: 'bottletypename',
    stockType: 'stocktype',
    changeType: 'changetype',
    previousQuantity: 'previousquantity',
    newQuantity: 'newquantity',
  },
  bottle_types: {
    totalQuantity: 'totalquantity',
    remainingQuantity: 'remainingquantity',
    distributedQuantity: 'distributedquantity',
    unitPrice: 'unitprice',
    taxRate: 'taxrate',
    purchasePrice: 'purchaseprice',
  },
  bank_transfers: {
    sourceAccount: 'sourceaccount',
    destinationAccount: 'destinationaccount',
    validatedAt: 'validatedat',
    validatedBy: 'validatedby',
  },
  repairs: {
    truckId: 'truck_id',
    paidAmount: 'paid_amount',
    debtAmount: 'debt_amount',
    paymentMethod: 'payment_method',
  },
  suppliers: {
    bankAccountName: 'bank_account_name',
  },
};
const tableColumnHints: Record<string, string[]> = {};
const resolveColumnName = (table: string, key: string) => {
  const tableMap = columnMap[table] || {};
  const columns = tableColumnHints[table] || [];
  const explicit = tableMap[key];
  if (explicit) return explicit;
  const normalizedTarget = key.toLowerCase();
  if (columns.length) {
    const direct = columns.find(col => col.toLowerCase() === normalizedTarget);
    if (direct) return direct;
    const normalized = columns.find(col => toCamelKey(col).toLowerCase() === normalizedTarget);
    if (normalized) return normalized;
    const snake = toSnakeKey(key);
    const flat = key.toLowerCase();
    const candidates = [snake, flat, snake.replace(/_/g, '')];
    const candidate = candidates.find(c => columns.includes(c));
    if (candidate) return candidate;
    return null;
  }
  return explicit ?? null;
};
const toWritePayload = (table: string, value: Record<string, any>) => {
  const payload: Record<string, any> = {};
  const columns = tableColumnHints[table] || [];
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || (typeof val === 'number' && isNaN(val))) continue;
    const resolved = resolveColumnName(table, key);
    if (resolved) {
      payload[resolved] = val;
      continue;
    }
    if (!columns.length) {
      const snake = toSnakeKey(key);
      payload[snake] = val;
      const flat = key.toLowerCase();
      if (flat !== snake) {
        payload[flat] = val;
      }
    }
  }
  return payload;
};
const missingColumnRegex = /Could not find the '([^']+)' column/;
const stripMissingColumn = (payload: Record<string, any>, column: string) => {
  const next = { ...payload };
  // Remove the exact column reported by Supabase
  delete next[column];
  // Also try to remove variations
  const variations = [
    toSnakeKey(column),
    toCamelKey(column),
    column.toLowerCase(),
    column.toLowerCase().replace(/_/g, ''),
  ];
  variations.forEach(v => {
    if (v !== column) delete next[v];
  });
  return next;
};
const stripMissingColumnMany = (payloads: Array<Record<string, any>>, column: string) =>
  payloads.map((payload) => stripMissingColumn(payload, column));

const normalizeBottleList = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object') {
        const rawQuantity = (item as any).quantity ?? (item as any).quantite ?? (item as any).qty ?? 0;
        return { ...item, quantity: Number(rawQuantity) || 0 };
      }
      return { quantity: Number(item) || 0 };
    });
  }
  if (typeof value === 'string') {
    try {
      return normalizeBottleList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([bottleTypeId, item]) => {
      if (item && typeof item === 'object') {
        const rawQuantity = (item as any).quantity ?? (item as any).quantite ?? (item as any).qty ?? 0;
        return { bottleTypeId, ...item, quantity: Number(rawQuantity) || 0 };
      }
      return { bottleTypeId, quantity: Number(item) || 0 };
    });
  }
  return [];
};

const normalizeFactoryOperationRow = (row: Record<string, any>) => {
  const sentBottles = normalizeBottleList(
    row.sentBottles ?? row.sent_bottles ?? row.sentbottles
  );
  const receivedBottles = normalizeBottleList(
    row.receivedBottles ?? row.received_bottles ?? row.receivedbottles
  );
  return {
    ...row,
    sentBottles,
    receivedBottles,
    debtChange: Number(row.debtChange ?? row.debtchange ?? 0) || 0
  };
};

const normalizeTransactionsRow = (row: Record<string, any>) => {
  const rawDetails = row.details ?? row.detail ?? row.meta ?? row.data;
  let parsedDetails: any = undefined;
  if (typeof rawDetails === 'string') {
    try {
      parsedDetails = JSON.parse(rawDetails);
    } catch {
      parsedDetails = undefined;
    }
  } else if (rawDetails && typeof rawDetails === 'object') {
    parsedDetails = rawDetails;
  }
  const amountCandidate =
    row.amount ??
    row.montant ??
    row.value ??
    row.totalValue ??
    row.totalvalue ??
    row.totalVentes ??
    row.totalventes ??
    row.total ??
    row.paymentAmount ??
    row.paymentamount ??
    row.paidAmount ??
    row.paidamount ??
    row.amountPaid ??
    row.amountpaid ??
    row.somme ??
    row.sum ??
    parsedDetails?.amount ??
    parsedDetails?.montant ??
    parsedDetails?.total ??
    parsedDetails?.value;
  const descriptionCandidate =
    row.description ??
    row.libelle ??
    row.label ??
    row.note ??
    row.comment ??
    parsedDetails?.description ??
    parsedDetails?.libelle ??
    parsedDetails?.label ??
    parsedDetails?.note ??
    parsedDetails?.comment;
  const amount =
    typeof amountCandidate === 'number'
      ? (isNaN(amountCandidate) ? 0 : amountCandidate)
      : typeof amountCandidate === 'string'
        ? Number(amountCandidate.replace(/[^0-9.-]/g, '')) || 0
        : Number(amountCandidate) || 0;
  const description =
    descriptionCandidate === null || descriptionCandidate === undefined
      ? ''
      : typeof descriptionCandidate === 'string'
        ? descriptionCandidate
        : typeof descriptionCandidate === 'number'
          ? descriptionCandidate.toString()
          : (() => {
              try {
                return JSON.stringify(descriptionCandidate);
              } catch {
                return String(descriptionCandidate);
              }
            })();
  return {
    ...row,
    amount,
    description,
  };
};

const normalizeRow = (table: string, row: Record<string, any>) => {
  if (table === 'factory_operations') {
    return normalizeFactoryOperationRow(row);
  }
  if (table === 'transactions') {
    return normalizeTransactionsRow(row);
  }
  return row;
};

export const supabaseService = {
  // Generic Fetch
  async getAll<T>(table: string): Promise<T[]> {
    const uid = await currentUserId();
    if (uid) {
      const { data, error } = await supabase.from(table).select("*").eq("user_id", uid);
      if (!error) {
        if (data && data.length && !tableColumnHints[table]) {
          tableColumnHints[table] = Object.keys(data[0] as Record<string, any>);
        }
        return (data ?? []).map((row) => {
          const camel = toCamelShallow(row as Record<string, any>);
          return normalizeRow(table, camel);
        }) as T[];
      }
      if (hasUserIdColumnError(error.message)) {
        console.error(`Missing user_id column for ${table}; user-scoped read blocked.`);
        return [];
      }
      console.error(`Error fetching from ${table}:`, error.message);
      return [];
    }
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.error(`Error fetching from ${table}:`, error.message);
      return [];
    }
    if (data && data.length && !tableColumnHints[table]) {
      tableColumnHints[table] = Object.keys(data[0] as Record<string, any>);
    }
    return (data ?? []).map((row) => {
      const camel = toCamelShallow(row as Record<string, any>);
      return normalizeRow(table, camel);
    }) as T[];
  },

  // Generic Create
  async create<T>(table: string, item: Partial<T>): Promise<T | null> {
    const uid = await currentUserId();
    const nextItem = uid ? { ...(item as Record<string, any>), user_id: uid } : (item as Record<string, any>);
    let payload = toWritePayload(table, nextItem);
    if (!Object.keys(payload).length) return null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      console.log(`Creating in ${table}, attempt ${attempt + 1}, payload keys:`, Object.keys(payload));
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (!error) {
        const camel = toCamelShallow(data as Record<string, any>);
        return normalizeRow(table, camel) as T;
      }
      console.warn(`Insert error in ${table}:`, error.message);
      const match = error.message.match(missingColumnRegex);
      if (!match) {
        console.error(`Error inserting into ${table}:`, error.message);
        return null;
      }
      const missingCol = match[1];
      if (uid && missingCol === 'user_id') {
        console.error(`Missing user_id column for ${table}; user-scoped insert blocked.`);
        return null;
      }
      console.log(`Stripping missing column: ${missingCol}`);
      payload = stripMissingColumn(payload, missingCol);
      if (!Object.keys(payload).length) return null;
    }
    console.error(`Error inserting into ${table}:`, "Too many missing columns");
    return null;
  },

  // Generic Update
  async update<T>(table: string, id: string | number, patch: Partial<T>): Promise<T | null> {
    const uid = await currentUserId();
    let payload = toWritePayload(table, patch as Record<string, any>);
    if (!Object.keys(payload).length) return null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      console.log(`Updating ${table} ${id}, attempt ${attempt + 1}, payload keys:`, Object.keys(payload));
      let response = await supabase
        .from(table)
        .update(payload)
        .eq("id", id)
        .eq(uid ? "user_id" : "id", uid ?? id)
        .select()
        .single();
      if (!response.error) {
        const camel = toCamelShallow(response.data as Record<string, any>);
        return normalizeRow(table, camel) as T;
      }
      console.warn(`Update error in ${table}:`, response.error.message);
      const match = response.error.message.match(missingColumnRegex);
      if (!match) {
        console.error(`Error updating ${table}:`, response.error.message);
        return null;
      }
      const missingCol = match[1];
      if (uid && missingCol === 'user_id') {
        console.error(`Missing user_id column for ${table}; user-scoped update blocked.`);
        return null;
      }
      console.log(`Stripping missing column: ${missingCol}`);
      payload = stripMissingColumn(payload, missingCol);
      if (!Object.keys(payload).length) return null;
    }
    console.error(`Error updating ${table}:`, "Too many missing columns");
    return null;
  },

  // Generic Delete
  async delete(table: string, id: string | number): Promise<boolean> {
    const uid = await currentUserId();
    let response = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq(uid ? "user_id" : "id", uid ?? id);
    if (response.error) {
      if (uid && hasUserIdColumnError(response.error.message)) {
        console.error(`Missing user_id column for ${table}; user-scoped delete blocked.`);
        return false;
      }
      console.error(`Error deleting from ${table}:`, response.error.message);
      return false;
    }
    return true;
  },

  // Bulk Upsert (useful for syncing/migration)
  async upsertMany<T>(table: string, items: T[]): Promise<void> {
    const uid = await currentUserId();
    const nextItems = uid
      ? items.map((item) => ({ ...(item as Record<string, any>), user_id: uid }))
      : items;
    let payloads = nextItems.map((item) => toWritePayload(table, item as Record<string, any>));
    for (let attempt = 0; attempt < 20; attempt += 1) {
      console.log(`Upserting many in ${table}, attempt ${attempt + 1}, keys:`, Object.keys(payloads[0] || {}));
      const { error } = await supabase.from(table).upsert(payloads);
      if (!error) return;
      console.warn(`Upsert error in ${table}:`, error.message);
      const match = error.message.match(missingColumnRegex);
      if (!match) {
        console.error(`Error upserting into ${table}:`, error.message);
        return;
      }
      const missingCol = match[1];
      if (uid && missingCol === 'user_id') {
        console.error(`Missing user_id column for ${table}; user-scoped upsert blocked.`);
        return;
      }
      console.log(`Stripping missing column: ${missingCol}`);
      payloads = stripMissingColumnMany(payloads, missingCol);
      if (!payloads.length || !Object.keys(payloads[0]).length) {
        console.error(`Error upserting into ${table}: All columns stripped or invalid payloads.`);
        return;
      }
    }
    console.error(`Error upserting into ${table}:`, "Too many missing columns");
  }
};
