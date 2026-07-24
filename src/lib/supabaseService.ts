import { supabase, supabaseConfigured } from "./supabaseClient";

const toSnakeKey = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const currentUserId = async (): Promise<string | null> => {
  if (!supabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
};
const hasUserIdColumnError = (message?: string) =>
  (message || '').toLowerCase().includes('user_id');
const hasNoRowsSingleError = (message?: string) => {
  const text = (message || '').toLowerCase();
  return text.includes('json object requested') && text.includes('no rows');
};
const sharedTables = new Set(["supply_orders", "return_orders", "factory_invoices"]);
const SHARED_TABLES_PAGE_SIZE = 1000;
const fetchSharedTableRows = async (table: string) => {
  const rows: Record<string, any>[] = [];
  let from = 0;

  while (true) {
    const to = from + SHARED_TABLES_PAGE_SIZE - 1;
    let query = supabase.from(table).select("*").order("date", { ascending: false });
    
    // Only order by created_at if not factory_invoices to avoid missing column errors if schema differs
    if (table !== 'factory_invoices') {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query.range(from, to);

    if (error) {
      return { data: null, error };
    }

    const batch = (data ?? []) as Record<string, any>[];
    rows.push(...batch);

    if (batch.length < SHARED_TABLES_PAGE_SIZE) {
      break;
    }

    from += SHARED_TABLES_PAGE_SIZE;
  }

  return { data: rows, error: null };
};
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
    accountAffected: 'account_affected',
    accountDetails: 'account_details',
    validatedAt: 'validated_at',
    validatedBy: 'validated_by',
  },
  financial_transactions: {
    sourceAccount: 'source_account',
    destinationAccount: 'destination_account',
    accountDetails: 'account_details',
    createdAt: 'created_at',
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
    sourceAccount: 'source_account',
    destinationAccount: 'destination_account',
    accountDetails: 'account_details',
    validatedAt: 'validated_at',
    validatedBy: 'validated_by',
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
  factory_invoices: {
    supplierId: 'supplier_id',
    blReferences: 'bl_references',
    totalSent: 'total_sent',
    totalReceived: 'total_received',
    totalAmount: 'total_amount',
    paymentMethod: 'payment_method',
    createdAt: 'created_at',
  },
};
const tableColumnHints: Record<string, string[]> = {};
const resolveColumnName = (table: string, key: string) => {
  const tableMap = columnMap[table] || {};
  const columns = tableColumnHints[table] || [];
  const explicit = tableMap[key];
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
    return explicit ?? null;
  }
  return explicit ?? null;
};
const toWritePayload = (table: string, value: Record<string, any>) => {
  const payload: Record<string, any> = {};
  const columns = tableColumnHints[table] || [];
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || (typeof val === 'number' && isNaN(val))) continue;
    if (table === 'factory_invoices' && !columns.length) {
      // Some existing Supabase projects ended up with camelCase or flat lowercase
      // columns for this table. Emit a few candidates; create()/update() already
      // strips missing columns on retry until the real schema remains.
      payload[key] = val;
      const snake = toSnakeKey(key);
      payload[snake] = val;
      const flat = key.toLowerCase();
      payload[flat] = val;
      payload[snake.replace(/_/g, '')] = val;
      continue;
    }
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
const stripMissingColumn = (payload: Record<string, any>, column: string, table?: string) => {
  const next = { ...payload };
  // Remove the exact column reported by Supabase
  delete next[column];
  if (table === 'factory_invoices') {
    // Keep alternative candidates for this table so retries can converge
    // on the real schema instead of deleting sibling variants too early.
    return next;
  }
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

const normalizeReturnOrderRow = (row: Record<string, any>) => {
  const rawItems = row.items ?? row.item ?? row.products ?? row.details;
  let items: any[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems;
  } else if (typeof rawItems === 'string') {
    try {
      const parsed = JSON.parse(rawItems);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      items = [];
    }
  } else if (rawItems && typeof rawItems === 'object') {
    items = [rawItems];
  }

  const rawNote = row.note ?? row.notes ?? row.paymentInfo;
  let parsedNote: any = null;
  if (typeof rawNote === 'string') {
    try {
      parsedNote = JSON.parse(rawNote);
    } catch {
      parsedNote = null;
    }
  } else if (rawNote && typeof rawNote === 'object') {
    parsedNote = rawNote;
  }

  const paymentDebt =
    Number(
      parsedNote?.debt ??
        row.paymentDebt ??
        row.payment_debt ??
        row.paymentdebt ??
        0
    ) || 0;

  const paymentTotal =
    Number(
      parsedNote?.total ??
        row.paymentTotal ??
        row.payment_total ??
        row.paymenttotal ??
        0
    ) || 0;

  const isPaidRaw =
    row.isPaid ??
    row.is_paid ??
    row.paid ??
    row.regle ??
    row.réglé ??
    row.reglé;
  const isPaid =
    typeof isPaidRaw === 'boolean'
      ? isPaidRaw
      : paymentTotal > 0
        ? paymentDebt <= 0
        : false;

  return {
    ...row,
    items,
    note: typeof rawNote === 'string' ? rawNote : rawNote ? JSON.stringify(rawNote) : row.note,
    paymentDebt,
    paymentTotal,
    isPaid,
  };
};

const normalizeSupplyOrderRow = (row: Record<string, any>) => {
  const rawItems = row.items ?? row.item ?? row.products ?? row.details;
  let items: any[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems;
  } else if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      items = [];
    }
  } else if (rawItems && typeof rawItems === "object") {
    items = [rawItems];
  }

  return {
    ...row,
    items,
  };
};

const normalizeFactoryInvoiceRow = (row: Record<string, any>) => {
  let blReferences: string[] = [];
  const rawBl = row.blReferences ?? row.bl_references ?? row.blreferences;
  if (Array.isArray(rawBl)) {
    blReferences = rawBl;
  } else if (typeof rawBl === "string") {
    try {
      blReferences = JSON.parse(rawBl);
    } catch {
      blReferences = [];
    }
  }
  return {
    ...row,
    blReferences,
    totalSent: Number(row.totalSent ?? row.total_sent ?? row.totalsent) || 0,
    totalReceived: Number(row.totalReceived ?? row.total_received ?? row.totalreceived) || 0,
    totalAmount: Number(row.totalAmount ?? row.total_amount ?? row.totalamount) || 0,
  };
};

const normalizeRow = (table: string, row: Record<string, any>) => {
  if (table === 'factory_invoices') {
    return normalizeFactoryInvoiceRow(row);
  }
  if (table === 'factory_operations') {
    return normalizeFactoryOperationRow(row);
  }
  if (table === 'transactions') {
    return normalizeTransactionsRow(row);
  }
  if (table === 'return_orders') {
    return normalizeReturnOrderRow(row);
  }
  if (table === 'supply_orders') {
    return normalizeSupplyOrderRow(row);
  }
  return row;
};

export const supabaseService = {
  // Generic Fetch
  async getAll<T>(table: string): Promise<T[]> {
    if (sharedTables.has(table)) {
      const { data, error } = await fetchSharedTableRows(table);
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
    }
    const uid = await currentUserId();
    if (uid) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .or(`user_id.eq.${uid},user_id.is.null`);
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
        // Table is not user-scoped; retry without user_id filter.
        const { data: shared, error: sharedError } = await supabase.from(table).select("*");
        if (sharedError) {
          console.error(`Error fetching from ${table}:`, sharedError.message);
          return [];
        }
        if (shared && shared.length && !tableColumnHints[table]) {
          tableColumnHints[table] = Object.keys(shared[0] as Record<string, any>);
        }
        return (shared ?? []).map((row) => {
          const camel = toCamelShallow(row as Record<string, any>);
          return normalizeRow(table, camel);
        }) as T[];
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
    const nextItem =
      uid && !sharedTables.has(table)
        ? { ...(item as Record<string, any>), user_id: uid }
        : (item as Record<string, any>);
    let payload = toWritePayload(table, nextItem);
    if (!Object.keys(payload).length) return null;
    
    let lastError = null;
    // #region debug-point factory-invoice-create
    if (table === 'factory_invoices') {
      (window as any).__factoryInvoiceDebug = {
        nextItem: { ...nextItem },
        initialPayload: { ...payload },
        attempts: [],
      };
    }
    // #endregion
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { error } = await supabase.from(table).insert(payload);
      if (error) {
        lastError = error;
        console.log(`[DEBUG] Insert error in ${table}:`, error);
        if (table === 'factory_invoices') {
          console.error(`FACTORY INVOICE INSERT ERROR: ${error.message}`);
          (window as any).lastSupabaseError = error.message; // Expose globally for debugging
          // #region debug-point factory-invoice-create
          const debugState = (window as any).__factoryInvoiceDebug;
          if (debugState) {
            debugState.attempts.push({
              attempt: attempt + 1,
              payload: { ...payload },
              error: error.message,
            });
          }
          // #endregion
        }
      }
      if (!error) {
        const insertedId = (payload.id ?? (nextItem as Record<string, any>).id) as string | number | undefined;
        if (insertedId !== undefined && insertedId !== null && insertedId !== "") {
          const { data: insertedData, error: fetchError } = await supabase
            .from(table)
            .select("*")
            .eq("id", insertedId)
            .maybeSingle();

          if (!fetchError && insertedData) {
            const camel = toCamelShallow(insertedData as Record<string, any>);
            return normalizeRow(table, camel) as T;
          }

          if (fetchError) {
            console.warn(`Post-insert fetch warning in ${table}:`, fetchError.message);
          }
        }

        return normalizeRow(table, nextItem as Record<string, any>) as T;
      }
      console.warn(`Insert error in ${table}:`, error.message);
      const match = error.message.match(missingColumnRegex);
      if (!match) {
        console.error(`Error inserting into ${table}:`, error.message);
        return null;
      }
      const missingCol = match[1];
      if (uid && missingCol === 'user_id') {
        console.log(`Retrying ${table} insert without user_id scope.`);
        payload = stripMissingColumn(payload, missingCol, table);
        if (!Object.keys(payload).length) return null;
        continue;
      }
      console.log(`Stripping missing column: ${missingCol}`);
      payload = stripMissingColumn(payload, missingCol, table);
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
      let response = sharedTables.has(table)
        ? await supabase
            .from(table)
            .update(payload)
            .eq("id", id)
            .select()
            .single()
        : await supabase
            .from(table)
            .update(payload)
            .eq("id", id)
            .or(uid ? `user_id.eq.${uid},user_id.is.null` : `id.eq.${id}`)
            .select()
            .single();
      if (!response.error) {
        const camel = toCamelShallow(response.data as Record<string, any>);
        return normalizeRow(table, camel) as T;
      }
      if (uid && (hasNoRowsSingleError(response.error.message) || hasUserIdColumnError(response.error.message))) {
        // Retry without user scope when rows are shared or table is not user-scoped.
        response = await supabase
          .from(table)
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (!response.error) {
          const camel = toCamelShallow(response.data as Record<string, any>);
          return normalizeRow(table, camel) as T;
        }
      }
      console.warn(`Update error in ${table}:`, response.error.message);
      const match = response.error.message.match(missingColumnRegex);
      if (!match) {
        console.error(`Error updating ${table}:`, response.error.message);
        return null;
      }
      const missingCol = match[1];
      if (uid && missingCol === 'user_id') {
        response = await supabase
          .from(table)
          .update(stripMissingColumn(payload, missingCol))
          .eq("id", id)
          .select()
          .single();
        if (!response.error) {
          const camel = toCamelShallow(response.data as Record<string, any>);
          return normalizeRow(table, camel) as T;
        }
        console.error(`Error updating ${table} without user scope:`, response.error.message);
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
    const response = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .select("id");

    if (response.error) {
      console.error(`Error deleting from ${table} (id: ${id}):`, response.error.message);
      return false;
    }

    if (Array.isArray(response.data) && response.data.length > 0) {
      return true;
    }

    // A delete can return no error even when RLS prevents touching any row.
    // Confirm whether the row still exists before reporting success.
    const existenceCheck = await supabase
      .from(table)
      .select("id")
      .eq("id", id)
      .limit(1);

    if (existenceCheck.error) {
      console.error(`Unable to verify deletion in ${table} (id: ${id}):`, existenceCheck.error.message);
      return false;
    }

    return (existenceCheck.data ?? []).length === 0;
  },

  // Bulk Upsert (useful for syncing/migration)
  async upsertMany<T>(table: string, items: T[]): Promise<void> {
    const uid = await currentUserId();
    const nextItems = uid && !sharedTables.has(table)
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
        payloads = stripMissingColumnMany(payloads, missingCol);
        if (!payloads.length || !Object.keys(payloads[0]).length) return;
        continue;
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
