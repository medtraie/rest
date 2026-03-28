import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabaseService } from "@/lib/supabaseService";
import { DollarSign, Plus, Search, Trash2, Pencil, Receipt, CreditCard, Banknote, Wallet } from "lucide-react";
import { toast } from "sonner";

type ExpenseCodeItem = {
  id: string;
  code: string;
  designation: string;
  account: string;
  taxable: boolean;
};
type CoptExpenseEntry = {
  id: string;
  source?: string;
  type?: string;
  code?: string;
  amount: number;
  paymentMethod: "espece" | "cheque" | "banque";
  date: string;
  note?: string;
};

const fallbackCodes: ExpenseCodeItem[] = [
  { id: "c1", code: "ACH AUTR", designation: "CHARGE DIVERS", account: "6126000", taxable: false },
  { id: "c2", code: "CHA FBQE", designation: "FRAIS BANCAIRE", account: "6147000", taxable: false },
  { id: "c3", code: "GAS DEP", designation: "GASOIL CAMIONS", account: "6122320", taxable: false },
  { id: "c4", code: "REP PNEU", designation: "PNEUX", account: "6133600", taxable: false },
  { id: "c5", code: "SAL LIVR", designation: "SALAIRE LIVR COM+FIX", account: "6171600", taxable: false },
  { id: "c6", code: "TAX ASS", designation: "ASSURANCE", account: "6134100", taxable: false },
  { id: "c7", code: "VTE BUT", designation: "VENTE BUTANE", account: "71114000", taxable: true },
  { id: "c8", code: "VTE CONS", designation: "VENTE CONSIGNE", account: "71115000", taxable: true },
  { id: "c9", code: "ZAX TVA", designation: "TVA OUED ZEM", account: "61261002", taxable: false },
];

const paymentMethods = ["espece", "cheque", "banque"] as const;

const DepensesCopt = () => {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string) => (language === "ar" ? ar : fr);
  const uiLocale = language === "ar" ? "ar-MA" : "fr-MA";

  const [catalog, setCatalog] = React.useState<ExpenseCodeItem[]>(fallbackCodes);
  const [entries, setEntries] = React.useState<CoptExpenseEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CoptExpenseEntry | null>(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"espece" | "cheque" | "banque">("espece");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "espece" | "cheque" | "banque">("all");

  React.useEffect(() => {
    const load = async () => {
      const [rows, allEntries] = await Promise.all([
        supabaseService.getAll<ExpenseCodeItem>("accounting_expense_codes"),
        supabaseService.getAll<CoptExpenseEntry>("accounting_entries"),
      ]);
      if (rows.length) setCatalog(rows);
      setEntries(allEntries.filter((item) => item.source === "depenses-copt" || item.type === "depense-codifiee"));
    };
    load();
  }, []);

  const codeMap = useMemo(() => new Map(catalog.map((item) => [item.code, item])), [catalog]);

  const coptExpenses = useMemo(() => {
    return entries.filter((item) => !!item.code && codeMap.has(item.code || ""));
  }, [entries, codeMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return coptExpenses.filter((item) => {
      const codeInfo = item.code ? codeMap.get(item.code) : undefined;
      const passesPayment = paymentFilter === "all" ? true : item.paymentMethod === paymentFilter;
      const passesSearch =
        q.length === 0 ||
        (item.code || "").toLowerCase().includes(q) ||
        (item.note || "").toLowerCase().includes(q) ||
        (codeInfo?.designation || "").toLowerCase().includes(q) ||
        (codeInfo?.account || "").toLowerCase().includes(q);
      return passesPayment && passesSearch;
    });
  }, [coptExpenses, search, paymentFilter, codeMap]);

  const totalAmount = useMemo(() => filtered.reduce((sum, item) => sum + item.amount, 0), [filtered]);
  const avgAmount = filtered.length ? totalAmount / filtered.length : 0;
  const topCode = useMemo(() => {
    const counters = new Map<string, number>();
    filtered.forEach((item) => {
      if (!item.code) return;
      counters.set(item.code, (counters.get(item.code) || 0) + item.amount);
    });
    const sorted = [...counters.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "-";
  }, [filtered]);

  const resetForm = () => {
    setEditingExpense(null);
    setSelectedCode("");
    setAmount("");
    setPaymentMethod("espece");
    setDate(new Date().toISOString().slice(0, 10));
    setNote("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: CoptExpenseEntry) => {
    setEditingExpense(item);
    setSelectedCode(item.code || "");
    setAmount(String(item.amount));
    setPaymentMethod((item.paymentMethod as "espece" | "cheque" | "banque") || "espece");
    setDate(new Date(item.date).toISOString().slice(0, 10));
    setNote(item.note || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCode || !amount || Number(amount) <= 0) {
      toast.error(tr("Veuillez renseigner le code et le montant", "يرجى تعبئة الكود والمبلغ"));
      return;
    }
    const linked = codeMap.get(selectedCode);
    const mergedNote = [linked?.designation, linked?.account ? `Compte ${linked.account}` : "", note].filter(Boolean).join(" | ");
    if (editingExpense) {
      const patch: Partial<CoptExpenseEntry> = {
        code: selectedCode,
        amount: Number(amount),
        paymentMethod,
        date,
        note: mergedNote,
      };
      const updated = await supabaseService.update<CoptExpenseEntry>("accounting_entries", editingExpense.id, patch);
      if (updated) {
        setEntries((prev) => prev.map((item) => (item.id === editingExpense.id ? updated : item)));
      }
      toast.success(tr("Dépense mise à jour", "تم تحديث المصروف"));
    } else {
      const next: CoptExpenseEntry = {
        id: window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        source: "depenses-copt",
        type: "depense-codifiee",
        code: selectedCode,
        amount: Number(amount),
        paymentMethod,
        date,
        note: mergedNote,
      };
      const created = await supabaseService.create<CoptExpenseEntry>("accounting_entries", next);
      if (created) setEntries((prev) => [created, ...prev]);
      toast.success(tr("Dépense enregistrée", "تم حفظ المصروف"));
    }
    setDialogOpen(false);
    resetForm();
  };

  const formatDateUi = (value: string) => new Date(value).toLocaleDateString(uiLocale, { year: "numeric", month: "2-digit", day: "2-digit" });

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{tr("Dépenses Copt", "مصروفات Copt")}</h1>
          <p className="text-slate-500">{tr("Système dépenses basé sur la liste codifiée intégrée", "نظام مصروفات مبني على لائحة الأكواد المدمجة")}</p>
        </div>
        <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-2" />
          {tr("Nouvelle dépense codifiée", "مصروف مرمز جديد")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">{tr("Total filtré", "إجمالي النتائج")}</p><p className="text-2xl font-black text-slate-900">{totalAmount.toFixed(2)} DH</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">{tr("Opérations", "العمليات")}</p><p className="text-2xl font-black text-slate-900">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">{tr("Moyenne", "المتوسط")}</p><p className="text-2xl font-black text-slate-900">{avgAmount.toFixed(2)} DH</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">{tr("Code dominant", "الكود الأعلى")}</p><p className="text-2xl font-black text-indigo-700">{topCode}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center gap-2 justify-between">
            <div className="relative w-full xl:max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Rechercher code, désignation, compte ou note...", "ابحث بالكود أو الوصف أو الحساب أو الملاحظة...")} className="pl-9 bg-slate-50" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={paymentFilter === "all" ? "default" : "outline"} onClick={() => setPaymentFilter("all")}>{tr("Tous", "الكل")}</Button>
              <Button variant={paymentFilter === "espece" ? "default" : "outline"} onClick={() => setPaymentFilter("espece")}>{tr("Espèce", "نقداً")}</Button>
              <Button variant={paymentFilter === "cheque" ? "default" : "outline"} onClick={() => setPaymentFilter("cheque")}>{tr("Chèque", "شيك")}</Button>
              <Button variant={paymentFilter === "banque" ? "default" : "outline"} onClick={() => setPaymentFilter("banque")}>{tr("Banque", "بنك")}</Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Code", "الكود")}</TableHead>
                  <TableHead>{tr("Désignation", "الوصف")}</TableHead>
                  <TableHead>{tr("Compte", "الحساب")}</TableHead>
                  <TableHead>{tr("Date", "التاريخ")}</TableHead>
                  <TableHead>{tr("Paiement", "طريقة الدفع")}</TableHead>
                  <TableHead className="text-right">{tr("Montant", "المبلغ")}</TableHead>
                  <TableHead className="text-center">{tr("Actions", "إجراءات")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 h-24">{tr("Aucune dépense codifiée trouvée", "لا توجد مصروفات مرمزة مطابقة")}</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => {
                    const codeInfo = item.code ? codeMap.get(item.code) : undefined;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.code}</TableCell>
                        <TableCell className="font-medium">{codeInfo?.designation || "-"}</TableCell>
                        <TableCell className="font-mono">{codeInfo?.account || "-"}</TableCell>
                        <TableCell>{formatDateUi(item.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.paymentMethod === "espece" && <Banknote className="w-4 h-4 text-emerald-600" />}
                            {item.paymentMethod === "cheque" && <Receipt className="w-4 h-4 text-amber-600" />}
                            {item.paymentMethod === "banque" && <CreditCard className="w-4 h-4 text-indigo-600" />}
                            <span>{item.paymentMethod}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-rose-700">-{(Number(item.amount) || 0).toFixed(2)} DH</TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(item)}><Pencil className="w-4 h-4" /></Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={async () => {
                                if (!window.confirm(tr("Supprimer cette dépense ?", "حذف هذا المصروف؟"))) return;
                                await supabaseService.delete("accounting_entries", item.id);
                                setEntries((prev) => prev.filter((row) => row.id !== item.id));
                                toast.success(tr("Dépense supprimée", "تم حذف المصروف"));
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{editingExpense ? tr("Modifier dépense codifiée", "تعديل مصروف مرمز") : tr("Nouvelle dépense codifiée", "مصروف مرمز جديد")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>{tr("Code de dépense", "كود المصروف")}</Label>
              <Select value={selectedCode} onValueChange={setSelectedCode}>
                <SelectTrigger><SelectValue placeholder={tr("Sélectionner un code", "اختر كودًا")} /></SelectTrigger>
                <SelectContent>
                  {catalog.map((item) => (
                    <SelectItem key={item.id} value={item.code}>
                      {item.code} - {item.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2 md:col-span-1">
                <Label>{tr("Date", "التاريخ")}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>{tr("Paiement", "الدفع")}</Label>
                <Select value={paymentMethod} onValueChange={(v: "espece" | "cheque" | "banque") => setPaymentMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>{tr("Montant (MAD)", "المبلغ (درهم)")}</Label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr("Note", "ملاحظة")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Détail optionnel...", "تفاصيل اختيارية...")} />
            </div>
            {selectedCode && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
                <div className="font-semibold">{codeMap.get(selectedCode)?.designation || "-"}</div>
                <div>{tr("Compte", "الحساب")}: {codeMap.get(selectedCode)?.account || "-"}</div>
                <div>{tr("Taxable", "خاضع للضريبة")}: {codeMap.get(selectedCode)?.taxable ? "True" : "False"}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{tr("Annuler", "إلغاء")}</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleSave}>
              <Wallet className="w-4 h-4 mr-2" />
              {editingExpense ? tr("Mettre à jour", "تحديث") : tr("Enregistrer", "حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepensesCopt;
