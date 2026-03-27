type Kind = "cash" | "transfer";

type QueueItem = {
  id: string;
  kind: Kind;
  payload: any;
  createdAt: string;
};

const KEY = "offline.queue.v1";

const read = (): QueueItem[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const write = (arr: QueueItem[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
};

export const getQueueSize = () => read().length;

export const enqueueCash = (payload: any) => {
  const item: QueueItem = { id: crypto.randomUUID?.() ?? String(Date.now()), kind: "cash", payload, createdAt: new Date().toISOString() };
  const arr = read();
  arr.push(item);
  write(arr);
  return item.id;
};

export const enqueueTransfer = (payload: any) => {
  const item: QueueItem = { id: crypto.randomUUID?.() ?? String(Date.now()), kind: "transfer", payload, createdAt: new Date().toISOString() };
  const arr = read();
  arr.push(item);
  write(arr);
  return item.id;
};

export const flushQueue = async (app: any) => {
  if (!navigator.onLine) return 0;
  const arr = read();
  let flushed = 0;
  const rest: QueueItem[] = [];
  for (const item of arr) {
    try {
      if (item.kind === "cash") {
        await app.addCashOperation(item.payload);
        flushed += 1;
      } else if (item.kind === "transfer") {
        await app.addBankTransfer(item.payload);
        flushed += 1;
      }
    } catch {
      rest.push(item);
    }
  }
  write(rest);
  return flushed;
};
