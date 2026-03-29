import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';

import { Package, FileText, Plus, Printer, Download, Search, Calendar, RotateCcw, Trash2, Edit, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Settings, DollarSign, Calculator, ArrowUpRight, ArrowDownLeft, Truck, AlertTriangle, Zap, Sparkles, RefreshCw, Eye, EyeOff, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupplyOrderItem, SupplyOrder, BottleType } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RecordReturnDialog } from '@/components/dialogs/RecordReturnDialog';
import { SupplyTruckDialog } from '@/components/dialogs/SupplyTruckDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn, safeDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage, useT } from '@/contexts/LanguageContext';

const SupplyReturn = () => {
  const { bottleTypes = [], drivers = [], clients = [], trucks = [], addClient, addSupplyOrder, updateBottleType, supplyOrders = [], returnOrders = [], deleteSupplyOrder, deleteReturnOrder, addRevenue, updateDriver, updateDriverDebt } = useApp();
  console.log(supplyOrders);
  const { toast } = useToast();
  const t = useT();
  const tsr = (key: string, fallback: string) => t(`supplyReturn.pdf.${key}`, fallback);
  const tsu = (key: string, fallback: string) => t(`supplyReturn.ui.${key}`, fallback);
  const { language } = useLanguage();
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const uiLocale = language === 'ar' ? 'ar-MA' : 'fr-MA';
  const formatDateUi = (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
    new Date(value).toLocaleDateString(uiLocale, options || { year: 'numeric', month: '2-digit', day: '2-digit' });



  const [selectedSupplyOrder, setSelectedSupplyOrder] = useState<SupplyOrder | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  
  // Delete confirmation dialogs
  const [deleteSupplyDialogOpen, setDeleteSupplyDialogOpen] = useState(false);
  const [deleteReturnDialogOpen, setDeleteReturnDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  
  const [selectionType, setSelectionType] = useState<'existing' | 'new-driver' | 'new-client' | 'petit-camion'>('existing');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [newDriverMatricule, setNewDriverMatricule] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [reference, setReference] = useState('');
  const [lastReference, setLastReference] = useState('');
  const [showInternalReference, setShowInternalReference] = useState(true);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  
  // Load last reference from localStorage when component mounts
  useEffect(() => {
    const savedReference = localStorage.getItem('lastSupplyReference');
    if (savedReference) {
      setLastReference(savedReference);
    }
  }, []);

  useEffect(() => {
    if (supplyOrders.length === 0) {
      setOrderNumber("BS-1");
    } else {
      const maxNum = supplyOrders.reduce((max, order) => {
        if (order.orderNumber && order.orderNumber.startsWith('BS-')) {
          const num = parseInt(order.orderNumber.split('-')[1]);
          if (!isNaN(num) && num > max) {
            return num;
          }
        }
        return max;
      }, 0);
      setOrderNumber(`BS-${maxNum + 1}`);
    }
  }, [supplyOrders]);
  
  const [items, setItems] = useState<SupplyOrderItem[]>([]);
  
  // Filters for supply orders history
  const [filterDriver, setFilterDriver] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Filters for return orders history
  const [returnStartDate, setReturnStartDate] = useState<Date | undefined>(undefined);
  const [returnEndDate, setReturnEndDate] = useState<Date | undefined>(undefined);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnFilterDriver, setReturnFilterDriver] = useState('all');
  const [returnFilterClient, setReturnFilterClient] = useState('all');
  const [returnCurrentPage, setReturnCurrentPage] = useState(1);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<any | null>(null);
  const [returnDetailsDialogOpen, setReturnDetailsDialogOpen] = useState(false);
  
  // Payment tracking states
  const [cashAmount, setCashAmount] = useState<string>('');
  const [checkAmount, setCheckAmount] = useState<string>('');
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  
  // Payment dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedReturnOrderForPayment, setSelectedReturnOrderForPayment] = useState<any | null>(null);
  const [paymentCashAmount, setPaymentCashAmount] = useState<string>('');
  const [paymentCheckAmount, setPaymentCheckAmount] = useState<string>('');
  const [paymentMygazAmount, setPaymentMygazAmount] = useState<string>('');

  // State for expense notes in return dialog
  const [expenseNotes, setExpenseNotes] = useState<{ description: string; amount: number }[]>([]);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const addExpenseNote = () => {
    const amount = parseFloat(expenseAmount);
    if (expenseDescription.trim() && amount > 0) {
      setExpenseNotes([...expenseNotes, { description: expenseDescription.trim(), amount }]);
      setExpenseDescription('');
      setExpenseAmount('');
    }
  };

  const removeExpenseNote = (index: number) => {
    setExpenseNotes(expenseNotes.filter((_, i) => i !== index));
  };

  const totalExpenses = useMemo(() => {
    return expenseNotes.reduce((total, note) => total + note.amount, 0);
  }, [expenseNotes]);
  
  // Supply details dialog
  const [supplyDetailsDialogOpen, setSupplyDetailsDialogOpen] = useState(false);
  const [supplyTruckDialogOpen, setSupplyTruckDialogOpen] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // الطي/الإظهار لقسم Historique des Bons de Sortie (محفوظ في localStorage)
  const [supplyHistoryOpen, setSupplyHistoryOpen] = useState<boolean>(() => {
    const v = localStorage.getItem("supplyReturn.historyOpen");
    return v ? v === "true" : false; // افتراضي: مخفي إذا لا يوجد تخزين سابق
  });
  useEffect(() => {
    localStorage.setItem("supplyReturn.historyOpen", String(supplyHistoryOpen));
  }, [supplyHistoryOpen]);
  

  // Calculate total amount from products
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  
  // Calculate debt (remaining amount)
  const calculateDebt = () => {
    const cash = parseFloat(cashAmount) || 0;
    const check = parseFloat(checkAmount) || 0;
    return Math.max(0, totalAmount - (cash + check));
  };

  // Get remaining debt for payment processing
  const getRemainingDebt = () => {
    const cash = parseFloat(cashAmount) || 0;
    const check = parseFloat(checkAmount) || 0;
    const { total } = calculateTotals();
    return Math.max(0, total - (cash + check));
  };

  // Reset payment form
  const resetPaymentForm = () => {
    setCashAmount('');
    setCheckAmount('');
    setShowPaymentSection(false);
  };
  
  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getWarehouseFull = (bt: BottleType) => {
    const totalStored = Number(bt?.totalQuantity || 0);
    const distributed = Number(bt?.distributedQuantity || 0);
    return Math.max(totalStored - distributed, 0);
  };
  
  const sortedBottleTypes = useMemo(() => {
    const desiredOrder = ["butane12kg", "butane3kg", "butane6kg", "bng12kg", "propane34kg", "detendeurclicon"];
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const keyFor = (name: string) => {
      const n = normalize(name);
      if (n.includes("butane") && n.includes("12kg")) return "butane12kg";
      if (n.includes("butane") && n.includes("3kg")) return "butane3kg";
      if (n.includes("butane") && n.includes("6kg")) return "butane6kg";
      if (n.includes("bng") && n.includes("12kg")) return "bng12kg";
      if (n.includes("propane") && n.includes("34kg")) return "propane34kg";
      if (n.includes("detendeur") || n.includes("clic")) return "detendeurclicon";
      return "";
    };
    return [...bottleTypes].sort((a, b) => {
      const ai = desiredOrder.indexOf(keyFor(a.name));
      const bi = desiredOrder.indexOf(keyFor(b.name));
      const aIdx = ai === -1 ? 1000 + bottleTypes.indexOf(a) : ai;
      const bIdx = bi === -1 ? 1000 + bottleTypes.indexOf(b) : bi;
      return aIdx - bIdx;
    });
  }, [bottleTypes]);
  
  const handleQuantityChange = (bottleTypeId: string, field: 'empty' | 'full', value: string) => {
    const raw = parseInt(value) || 0;
    const bottleType = bottleTypes.find(bt => bt.id === bottleTypeId);
    if (!bottleType) return;

    const safeQuantity =
      field === 'full'
        ? Math.max(0, Math.min(raw, getWarehouseFull(bottleType)))
        : Math.max(0, raw);

    setItems(prev => {
      const existing = prev.find(item => item.bottleTypeId === bottleTypeId);

      if (existing) {
        const updated = { ...existing };
        if (field === 'empty') updated.emptyQuantity = safeQuantity;
        if (field === 'full') updated.fullQuantity = safeQuantity;
        updated.amount = updated.fullQuantity * bottleType.unitPrice;

        return prev.map(item => item.bottleTypeId === bottleTypeId ? updated : item);
      } else {
        const newItem: SupplyOrderItem = {
          bottleTypeId: bottleType.id,
          bottleTypeName: bottleType.name,
          emptyQuantity: field === 'empty' ? safeQuantity : 0,
          fullQuantity: field === 'full' ? safeQuantity : 0,
          unitPrice: bottleType.unitPrice,
          taxLabel: `${bottleType.taxRate}%`,
          amount: (field === 'full' ? safeQuantity : 0) * bottleType.unitPrice
        };

        return [...prev, newItem];
      }
    });
  };
  
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = 10; // 10% TVA
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    
    return { subtotal, taxRate, taxAmount, total };
  };
  
  const handleSubmit = () => {
    if (items.length === 0) {
      toast({
        title: tr("Erreur", "خطأ"),
        description: tr("Veuillez ajouter au moins un produit", "يرجى إضافة منتج واحد على الأقل"),
        variant: "destructive"
      });
      return;
    }
    
    // Client is now optional, so we don't check for it
    
    if (selectionType === 'new-driver' && !newDriverMatricule.trim()) {
      toast({
        title: tr("Erreur", "خطأ"),
        description: tr("Veuillez entrer un matricule", "يرجى إدخال رقم الشاحنة"),
        variant: "destructive"
      });
      return;
    }
    
    if (selectionType === 'new-client' && !newClientName.trim()) {
      toast({
        title: tr("Erreur", "خطأ"),
        description: tr("Veuillez entrer un nom de client", "يرجى إدخال اسم الزبون"),
        variant: "destructive"
      });
      return;
    }

    if (selectionType === 'petit-camion' && (!selectedTruckId || !selectedDriverId)) {
      toast({
        title: tr("Sélection requise", "اختيار مطلوب"),
        description: tr("Veuillez sélectionner Allogaz et un chauffeur", "يرجى اختيار Allogaz وسائق"),
        variant: "destructive",
      });
      return;
    }
    
    // Update stock
    items.forEach(item => {
      const bottleType = bottleTypes.find(bt => bt.id === item.bottleTypeId);
      if (bottleType) {
        const currentDistributed = Number(bottleType.distributedQuantity || 0);
        const currentRemaining = Number(bottleType.totalQuantity || 0) - currentDistributed;
        const fullQty = Number(item.fullQuantity || 0);
        const newRemainingQuantity = currentRemaining - fullQty;
        const newDistributedQuantity = currentDistributed + fullQty;
        
        updateBottleType(item.bottleTypeId, {
          remainingQuantity: newRemainingQuantity,
          distributedQuantity: newDistributedQuantity
        });
      }
    });
    
    const { subtotal, taxRate, taxAmount, total } = calculateTotals();
    
    // Handle client
    let finalClientId: string | undefined = undefined;
    let finalClientName = '';
    
    if (selectionType === 'new-client' && newClientName.trim()) {
      const newClient = { name: newClientName.trim() };
      const clientId = addClient(newClient);
      finalClientId = clientId;
      finalClientName = newClientName.trim();
    } else if (selectedClientId) {
      const client = clients.find(c => String(c.id) === String(selectedClientId));
      if (client) {
        finalClientId = String(client.id);
        finalClientName = client.name;
      }
    }

    // Ensure client is cleared for petit-camion
    if (selectionType === 'petit-camion') {
      finalClientId = undefined;
      finalClientName = '';
    }
    
    // Handle driver
    let finalDriverId: string | undefined = undefined;
    let finalDriverName = '';

    if (selectionType === 'new-driver' && newDriverMatricule.trim()) {
      finalDriverName = newDriverMatricule.trim();
      // For new drivers, we don't have an ID yet
    } else if (selectedDriverId) {
      const driver = drivers.find(d => String(d.id) === String(selectedDriverId));
      if (driver) {
        finalDriverId = String(driver.id);
        finalDriverName = driver.name;
      }
    }

    // Special handling for petit-camion driver
    if (selectionType === 'petit-camion' && selectedDriverId) {
      const driver = drivers.find(d => String(d.id) === String(selectedDriverId));
      if (driver) {
        finalDriverId = String(driver.id);
        finalDriverName = driver.name;
      }
    }
    
    // Process payments if payment section is shown
    if (showPaymentSection) {
      const cashAmountNum = parseFloat(cashAmount) || 0;
      const checkAmountNum = parseFloat(checkAmount) || 0;
      const debtAmount = getRemainingDebt();
      
      // Add cash and check operations directly
      if (cashAmountNum > 0) {
        addCashOperation({
          date: new Date().toISOString(),
          name: `Paiement Espèce (B.S ${orderNumber})`,
          amount: cashAmountNum,
          type: 'versement',
          accountAffected: 'espece',
          status: 'validated',
        });
      }
      if (checkAmountNum > 0) {
        addCashOperation({
          date: new Date().toISOString(),
          name: `Paiement Chèque (B.S ${orderNumber})`,
          amount: checkAmountNum,
          type: 'versement',
          accountAffected: 'cheque',
          status: 'validated',
        });
      }
      
      // Update driver debt if there's remaining debt and a driver is selected
      if (debtAmount > 0 && finalDriverId) {
        updateDriver(finalDriverId, {
          debt: debtAmount
        });
      }
    }
    
    addSupplyOrder({
      // Allow AppContext to generate a unique UUID for the ID
      // id: orderNumber, 
      orderNumber: orderNumber,
      reference,
      date: orderDate ? orderDate.toISOString() : new Date().toISOString(),
      driverId: finalDriverId || undefined,
      driverName: finalDriverName || undefined,
      clientId: finalClientId || undefined,
      clientName: finalClientName || undefined,
      truckId: selectionType === 'petit-camion' ? selectedTruckId : undefined,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total
    });
    setSupplyHistoryOpen(true);
    
    toast({
      title: tr("Bon de sortie créé", "تم إنشاء سند الخروج"),
      description: language === 'ar' ? `تم إنشاء B.S رقم ${orderNumber} بنجاح` : `B.S N° ${orderNumber} a été créé avec succès`,
    });
    
    // Save the last reference if it exists
    if (reference) {
      localStorage.setItem('lastSupplyReference', reference);
      setLastReference(reference);
    }
    
    // Reset form
    resetPaymentForm();
    setItems([]);
    setSelectedDriverId('');
    setSelectedClientId('');
    setSelectedTruckId('');
    setNewDriverMatricule('');
    setNewClientName('')
  };
  
  const handlePrintBS = (order: SupplyOrder) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      
      // Colors & Styles
      const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const lightGray = [248, 250, 252]; // Slate-50

      // Header Background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 45, 'F');

      // Brand & Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text(t('brand', 'SFT GAZ'), 14, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(tsr('systemTitle', 'SYSTÈME DE GESTION DE DISTRIBUTION'), 14, 32);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(tsr('bsTitle', 'BON DE SORTIE (B.S)'), 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N° ${order.orderNumber}`, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      
      // Card 1: Order Details
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');
      // Card 2: Driver/Client Info
      doc.roundedRect(106, 55, 90, 45, 2, 2, 'FD');

      const drawInfoLabel = (label: string, value: string, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(value, x, y + 6);
      };

      // Card 1 Content
      drawInfoLabel(tsr('issueDate', "Date d'émission"), format(new Date(order.date), 'dd MMMM yyyy HH:mm', { locale: fr }), 20, 68);
      if (order.reference) {
        drawInfoLabel(tsr('reference', 'Référence'), order.reference, 20, 85);
      }

      // Card 2 Content
      if (order.driverName) {
        drawInfoLabel(tsr('driver', 'Chauffeur'), order.driverName, 112, 68);
      } else {
        drawInfoLabel(tsr('driver', 'Chauffeur'), tsr('notSpecified', 'Non spécifié'), 112, 68);
      }
      
      if (order.clientName) {
        drawInfoLabel(tsr('client', 'Client'), order.clientName, 112, 85);
      } else if (order.truckId) {
        const truck = trucks.find(t => t.id === order.truckId);
        drawInfoLabel(tsr('allogaz', 'Allogaz'), truck ? truck.matricule : 'N/A', 112, 85);
      }

      // Products Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(tsr('productDetails', 'Détails des Produits'), 14, 115);

      const tableData = order.items.map(item => [
        item.bottleTypeName,
        item.emptyQuantity.toString(),
        item.fullQuantity.toString(),
        `${(Number(item.unitPrice) || 0).toFixed(2)} DH`,
        item.taxLabel,
        `${(Number(item.amount) || 0).toFixed(2)} DH`
      ]);

      autoTable(doc, {
        startY: 120,
        head: [[tsr('product', 'Produit'), tsr('empty', 'Vides'), tsr('full', 'Pleines'), tsr('unitPriceShort', 'P.U'), tsr('vat', 'TVA'), tsr('amount', 'Montant')]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 4
        },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'center' },
          5: { halign: 'right', fontStyle: 'bold' }
        },
        styles: {
          fontSize: 9,
          cellPadding: 5,
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 120;

      // Summary & Totals
      const summaryY = finalY + 15;
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(110, summaryY, 86, 35, 2, 2, 'F');
      
      const drawSummaryRow = (label: string, value: string, y: number, color = [30, 41, 59], bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(label, 115, y);
        doc.text(value, 190, y, { align: 'right' });
      };

      drawSummaryRow(`${tsr('amountHt', 'Montant HT')}:`, `${(Number(order.subtotal) || 0).toFixed(2)} DH`, summaryY + 10);
      drawSummaryRow(`${tsr('vat', 'TVA')} (${order.taxRate}%):`, `${(Number(order.taxAmount) || 0).toFixed(2)} DH`, summaryY + 18);
      drawSummaryRow(`${tsr('totalTtc', 'Total TTC')}:`, `${(Number(order.total) || 0).toFixed(2)} DH`, summaryY + 28, primaryColor, true);

      // Signature area
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(tsr('driverClientSignature', 'Signature du Chauffeur / Client'), 14, summaryY + 25);
      doc.line(14, summaryY + 27, 70, summaryY + 27);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${tsr('autoGeneratedBy', 'Document généré automatiquement par SFT GAZ le')} ${format(now, 'dd/MM/yyyy à HH:mm')}`,
          14,
          282
        );
        doc.text(
          `${tsr('page', 'Page')} ${i} / ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`BS_${order.orderNumber}_${format(new Date(order.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur PDF:", error);
      toast({
        title: tr("Erreur", "خطأ"),
        description: tr("Erreur lors de la génération du PDF", "حدث خطأ أثناء إنشاء PDF"),
        variant: "destructive"
      });
    }
  };

  const filteredOrders = (supplyOrders || []).filter(order => {
    const orderDate = new Date(order.date);
    if (startDate && orderDate < startDate) return false;
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (orderDate > endOfDay) return false;
    }
    if (filterDriver !== 'all' && order.driverId !== filterDriver) return false;
    if (filterClient !== 'all' && order.clientId !== filterClient) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(query) ||
        order.driverName?.toLowerCase().includes(query) ||
        order.clientName?.toLowerCase().includes(query)
      );
    }
    return true;
  }).sort((a, b) => {
    const aValue = a[sortField as keyof typeof a];
    const bValue = b[sortField as keyof typeof b];

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const filteredReturnOrders = (returnOrders || []).filter(order => {
    const orderDate = new Date(order.date);
    if (returnStartDate && orderDate < returnStartDate) return false;
    if (returnEndDate) {
      const endOfDay = new Date(returnEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (orderDate > endOfDay) return false;
    }
    if (returnFilterDriver !== 'all' && order.driverId !== returnFilterDriver) return false;
    if (returnFilterClient !== 'all' && order.clientId !== returnFilterClient) return false;
    if (returnSearchQuery) {
      const query = returnSearchQuery.toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(query) ||
        order.supplyOrderNumber.toLowerCase().includes(query) ||
        (order.driverName && order.driverName.toLowerCase().includes(query)) ||
        (order.clientName && order.clientName.toLowerCase().includes(query))
      );
    }
    return true;
  }).sort((a, b) => {
    const aValue = a[sortField as keyof typeof a];
    const bValue = b[sortField as keyof typeof b];

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const dashboardStats = useMemo(() => {
    const totalSupplyAmount = filteredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const paidReturns = filteredReturnOrders.filter((order: any) => Boolean(order.isPaid)).length;
    const pendingReturns = filteredReturnOrders.length - paidReturns;
    const today = new Date();
    const sameDay = (dateValue: string) => {
      const d = safeDate(dateValue);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    };
    const supplyToday = filteredOrders.filter((order) => sameDay(order.date)).length;
    const returnsToday = filteredReturnOrders.filter((order: any) => sameDay(order.date)).length;
    return {
      totalSupplyAmount,
      paidReturns,
      pendingReturns,
      supplyToday,
      returnsToday
    };
  }, [filteredOrders, filteredReturnOrders]);

  const commandTimeline = useMemo(() => {
    const supplyFlow = filteredOrders.map((order) => ({
      id: `s-${order.id}`,
      kind: 'supply' as const,
      date: safeDate(order.date),
      title: `B.S ${order.orderNumber}`,
      subtitle: `${order.driverName || tr('Sans Chauffeur', 'بدون سائق')}${order.clientName ? ` · ${order.clientName}` : ''}`,
      amountLabel: `${(Number(order.total) || 0).toFixed(2)} DH`
    }));
    const returnFlow = filteredReturnOrders.map((order: any) => ({
      id: `r-${order.id}`,
      kind: 'return' as const,
      date: safeDate(order.date),
      title: `B.D ${order.orderNumber}`,
      subtitle: `${tr('Source', 'المصدر')} ${order.supplyOrderNumber}${order.driverName ? ` · ${order.driverName}` : ''}`,
      amountLabel: order.isPaid ? tr('Réglé', 'مسدد') : tr('En attente', 'قيد الانتظار')
    }));
    return [...supplyFlow, ...returnFlow]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }, [filteredOrders, filteredReturnOrders]);

  const anomalySignals = useMemo(() => {
    const missingSourceReturns = filteredReturnOrders.filter((order: any) => !supplyOrders.some((s) => String(s.id) === String(order.supplyOrderId)));
    const staleSupplies = filteredOrders.filter((order) => {
      const hasReturn = returnOrders.some((ret: any) => String(ret.supplyOrderId) === String(order.id));
      const age = (Date.now() - safeDate(order.date).getTime()) / (1000 * 60 * 60 * 24);
      return !hasReturn && age >= 7;
    });
    const pendingRatio = filteredReturnOrders.length > 0 ? dashboardStats.pendingReturns / filteredReturnOrders.length : 0;
    const signals = [
      {
        id: 'pending-ratio',
        level: pendingRatio >= 0.45 ? 'high' as const : pendingRatio >= 0.25 ? 'medium' as const : 'low' as const,
        title: tr('Taux de règlement', 'معدل التسوية'),
        value: `${Math.round(pendingRatio * 100)}%`,
        hint: language === 'ar'
          ? `${dashboardStats.pendingReturns} سند/سندات غير مسددة`
          : `${dashboardStats.pendingReturns} bons non réglés`
      },
      {
        id: 'missing-source',
        level: missingSourceReturns.length > 0 ? 'high' as const : 'low' as const,
        title: tr('Retours sans source B.S', 'مرتجعات بدون مصدر B.S'),
        value: `${missingSourceReturns.length}`,
        hint: missingSourceReturns.length > 0
          ? tr('Vérifier la liaison supplyOrderId', 'تحقق من ربط supplyOrderId')
          : tr('Aucun incident détecté', 'لا يوجد أي خلل')
      },
      {
        id: 'stale-supply',
        level: staleSupplies.length >= 4 ? 'high' as const : staleSupplies.length > 0 ? 'medium' as const : 'low' as const,
        title: tr('B.S sans retour +7j', 'B.S بدون إرجاع +7 أيام'),
        value: `${staleSupplies.length}`,
        hint: staleSupplies.length > 0
          ? tr('Suivi chauffeur/client recommandé', 'يُنصح بمتابعة السائق/الزبون')
          : tr('Flux retour nominal', 'تدفق الإرجاع طبيعي')
      }
    ];
    return signals;
  }, [filteredReturnOrders, filteredOrders, supplyOrders, returnOrders, dashboardStats.pendingReturns]);

  const adaptiveRisk = useMemo(() => {
    const pendingRatio = filteredReturnOrders.length > 0 ? dashboardStats.pendingReturns / filteredReturnOrders.length : 0;
    const missingSourceCount = filteredReturnOrders.filter((order: any) => !supplyOrders.some((s) => String(s.id) === String(order.supplyOrderId))).length;
    const staleSupplyCount = filteredOrders.filter((order) => {
      const hasReturn = returnOrders.some((ret: any) => String(ret.supplyOrderId) === String(order.id));
      const age = (Date.now() - safeDate(order.date).getTime()) / (1000 * 60 * 60 * 24);
      return !hasReturn && age >= 7;
    }).length;
    const activityGap = Math.abs(dashboardStats.supplyToday - dashboardStats.returnsToday);
    const score = Math.min(
      100,
      Math.round(
        pendingRatio * 55 +
        Math.min(missingSourceCount, 3) * 16 +
        Math.min(staleSupplyCount, 6) * 6 +
        Math.min(activityGap, 10) * 2
      )
    );
    const level = score >= 70 ? 'high' as const : score >= 35 ? 'medium' as const : 'low' as const;
    const tone = level === 'high' ? 'rose' : level === 'medium' ? 'amber' : 'emerald';
    const label = level === 'high' ? tr('Risque élevé', 'مخاطر مرتفعة') : level === 'medium' ? tr('Risque modéré', 'مخاطر متوسطة') : tr('Risque maîtrisé', 'مخاطر مضبوطة');
    return { score, level, tone, label };
  }, [filteredReturnOrders, filteredOrders, supplyOrders, returnOrders, dashboardStats.pendingReturns, dashboardStats.supplyToday, dashboardStats.returnsToday]);

  const pendingPaymentOrder = useMemo(
    () => filteredReturnOrders.find((order: any) => !order.isPaid) || null,
    [filteredReturnOrders]
  );

  const adaptiveQuickActions = useMemo(() => {
    return [
      {
        id: 'create-bs',
        label: tr('Nouveau Bon de Sortie', 'سند خروج جديد'),
        description: tr('Accès direct à la création d’un B.S', 'وصول مباشر لإنشاء سند خروج'),
        tone: 'indigo' as const,
        priority: adaptiveRisk.level === 'low' ? 40 : 20,
        disabled: false
      },
      {
        id: 'open-payment',
        label: tr('Ouvrir premier règlement en attente', 'فتح أول تسوية معلّقة'),
        description: pendingPaymentOrder
          ? (language === 'ar'
              ? `الهدف: B.D ${pendingPaymentOrder.orderNumber}`
              : `Cible: B.D ${pendingPaymentOrder.orderNumber}`)
          : tr('Aucun règlement en attente', 'لا توجد تسوية معلّقة'),
        tone: 'amber' as const,
        priority: pendingPaymentOrder ? 100 : 10,
        disabled: !pendingPaymentOrder
      },
      {
        id: 'quick-return',
        label: tr('Retour rapide depuis dernier B.S', 'إرجاع سريع من آخر B.S'),
        description: filteredOrders[0]
          ? (language === 'ar'
              ? `المصدر: ${filteredOrders[0].orderNumber}`
              : `Source: ${filteredOrders[0].orderNumber}`)
          : tr('Aucun B.S disponible', 'لا يوجد أي B.S متاح'),
        tone: 'emerald' as const,
        priority: filteredOrders[0] ? 60 : 5,
        disabled: !filteredOrders[0]
      },
      {
        id: 'open-history',
        label: tr('Aller à l’historique détaillé', 'الانتقال إلى السجل المفصل'),
        description: tr('Naviguer vers les flux détaillés', 'التنقل نحو التدفقات المفصلة'),
        tone: 'slate' as const,
        priority: adaptiveRisk.level === 'high' ? 90 : 30,
        disabled: false
      }
    ].sort((a, b) => b.priority - a.priority);
  }, [adaptiveRisk.level, filteredOrders, pendingPaymentOrder, language]);

  const configInsight = useMemo(() => {
    const hasDate = Boolean(orderDate);
    const hasRecipient =
      (selectionType === 'existing' && (Boolean(selectedDriverId) || Boolean(selectedClientId))) ||
      (selectionType === 'new-driver' && newDriverMatricule.trim().length > 0) ||
      (selectionType === 'new-client' && newClientName.trim().length > 0) ||
      (selectionType === 'petit-camion' && Boolean(selectedTruckId) && Boolean(selectedDriverId));
    const hasItems = items.length > 0;
    const score = Math.round(((Number(hasDate) + Number(hasRecipient) + Number(hasItems)) / 3) * 100);
    const label = score >= 90 ? tr('Prêt à valider', 'جاهز للتأكيد') : score >= 50 ? tr('Presque prêt', 'جاهز تقريبًا') : tr('À compléter', 'يحتاج إكمال');
    return { score, label };
  }, [orderDate, selectionType, selectedDriverId, selectedClientId, newDriverMatricule, newClientName, selectedTruckId, items.length]);

  const [selectedBottleTypeIds, setSelectedBottleTypeIds] = useState<Set<string>>(new Set());
  const [bottleTypeQuery, setBottleTypeQuery] = useState('');
  const filteredBottleTypes = useMemo(() => {
    const q = bottleTypeQuery.trim().toLowerCase();
    if (!q) return sortedBottleTypes;
    return sortedBottleTypes.filter(bt =>
      `${bt.name} ${bt.capacity || ''}`.toLowerCase().includes(q)
    );
  }, [sortedBottleTypes, bottleTypeQuery]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showAnomaly, setShowAnomaly] = useState(true);
  const displayedSectionsCount = (showQuickActions ? 1 : 0) + (showTimeline ? 1 : 0) + (showAnomaly ? 1 : 0);
  useEffect(() => {
    const saved = localStorage.getItem('sr_sections_vis_v1');
    if (saved) {
      try {
        const o = JSON.parse(saved);
        if (typeof o.showQuickActions === 'boolean') setShowQuickActions(o.showQuickActions);
        if (typeof o.showTimeline === 'boolean') setShowTimeline(o.showTimeline);
        if (typeof o.showAnomaly === 'boolean') setShowAnomaly(o.showAnomaly);
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('sr_sections_vis_v1', JSON.stringify({ showQuickActions, showTimeline, showAnomaly }));
  }, [showQuickActions, showTimeline, showAnomaly]);
  const productInsight = useMemo(() => {
    const selectedTypes = items.filter((item) => Number(item.fullQuantity || 0) > 0).length;
    const selectedVolume = items.reduce((sum, item) => sum + Number(item.fullQuantity || 0), 0);
    const lowWarehouseTypes = sortedBottleTypes.filter((bt) => getWarehouseFull(bt) <= 8).length;
    const health = lowWarehouseTypes >= 3 ? 'high' as const : lowWarehouseTypes > 0 ? 'medium' as const : 'low' as const;
    return { selectedTypes, selectedVolume, lowWarehouseTypes, health };
  }, [items, sortedBottleTypes]);

  const financialInsight = useMemo(() => {
    const averageTicket = filteredOrders.length > 0 ? dashboardStats.totalSupplyAmount / filteredOrders.length : 0;
    const paymentCoverage = filteredReturnOrders.length > 0 ? dashboardStats.paidReturns / filteredReturnOrders.length : 0;
    const paymentLabel = paymentCoverage >= 0.75
      ? tr('Encaissement fort', 'تحصيل قوي')
      : paymentCoverage >= 0.45
        ? tr('Encaissement stable', 'تحصيل مستقر')
        : tr('Encaissement fragile', 'تحصيل هش');
    return {
      averageTicket,
      paymentCoverage,
      paymentLabel
    };
  }, [filteredOrders.length, dashboardStats.totalSupplyAmount, filteredReturnOrders.length, dashboardStats.paidReturns, language]);

  const historyInsight = useMemo(() => {
    const recentSupply = filteredOrders.filter((order) => (Date.now() - safeDate(order.date).getTime()) / (1000 * 60 * 60 * 24) <= 2).length;
    const recentReturn = filteredReturnOrders.filter((order: any) => (Date.now() - safeDate(order.date).getTime()) / (1000 * 60 * 60 * 24) <= 2).length;
    const status = recentReturn > recentSupply ? 'return-dominant' : recentReturn < recentSupply ? 'supply-dominant' : 'balanced';
    return { recentSupply, recentReturn, status };
  }, [filteredOrders, filteredReturnOrders]);

  const sectionTone = useMemo(() => {
    if (adaptiveRisk.level === 'high') {
      return {
        configBar: 'bg-rose-600',
        productBar: 'bg-amber-500',
        financialAccent: 'text-amber-300',
      };
    }
    if (adaptiveRisk.level === 'medium') {
      return {
        configBar: 'bg-amber-600',
        productBar: 'bg-emerald-500',
        financialAccent: 'text-emerald-300',
      };
    }
    return {
      configBar: 'bg-indigo-600',
      productBar: 'bg-emerald-500',
      financialAccent: 'text-emerald-300',
    };
  }, [adaptiveRisk.level]);

  const supplyFiltersActive = useMemo(
    () => Boolean(searchQuery) || Boolean(startDate) || Boolean(endDate) || filterDriver !== 'all' || filterClient !== 'all',
    [searchQuery, startDate, endDate, filterDriver, filterClient]
  );

  const returnFiltersActive = useMemo(
    () => Boolean(returnSearchQuery) || Boolean(returnStartDate) || Boolean(returnEndDate) || returnFilterDriver !== 'all' || returnFilterClient !== 'all',
    [returnSearchQuery, returnStartDate, returnEndDate, returnFilterDriver, returnFilterClient]
  );

  const scrollToSection = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetSupplyHistoryFilters = () => {
    setSearchQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setFilterDriver('all');
    setFilterClient('all');
  };

  const resetReturnHistoryFilters = () => {
    setReturnSearchQuery('');
    setReturnStartDate(undefined);
    setReturnEndDate(undefined);
    setReturnFilterDriver('all');
    setReturnFilterClient('all');
  };

  const runQuickAction = (actionId: string) => {
    if (actionId === 'create-bs') {
      setSelectionType('existing');
      scrollToSection('command-create-bs');
      return;
    }
    if (actionId === 'quick-return') {
      const latestSupply = filteredOrders[0];
      if (!latestSupply) {
        toast({
          title: tr("Aucun B.S disponible", "لا يوجد B.S متاح"),
          description: tr("Créez un bon de sortie avant d'enregistrer un retour", "أنشئ سند خروج قبل تسجيل الإرجاع"),
          variant: "destructive"
        });
        return;
      }
      setSelectedSupplyOrder(latestSupply);
      setReturnDialogOpen(true);
      return;
    }
    if (actionId === 'open-payment') {
      scrollToSection('command-return-history');
      if (!pendingPaymentOrder) return;
      setSelectedReturnOrderForPayment(pendingPaymentOrder);
      setPaymentDialogOpen(true);
      return;
    }
    scrollToSection('command-history');
  };

  const handleDeleteSupplyOrder = (id: string) => {
    // Restore stock from the deleted supply order
    const order = (supplyOrders || []).find((o: any) => o.id === id);

    if (order && order.items && order.items.length > 0) {
      order.items.forEach((item: any) => {
        const bt = bottleTypes.find(b => b.id === item.bottleTypeId);
        if (!bt) return;

        const fullQty = Number(item.fullQuantity || 0);

        const maxTotal = Number((bt as any).totalQuantity ?? bt.totalQuantity ?? (bt as any).totalquantity ?? 0);
        const currentRemaining = Number(bt.remainingQuantity || 0);
        const currentDistributed = Number(bt.distributedQuantity || 0);
        const computedRemaining = currentRemaining + fullQty;
        const newRemaining = maxTotal > 0 ? Math.min(maxTotal, computedRemaining) : computedRemaining;
        const newDistributed = Math.max(0, currentDistributed - fullQty);

        updateBottleType(item.bottleTypeId, {
          remainingQuantity: newRemaining,
          distributedQuantity: newDistributed,
        });
      });
    }

    deleteSupplyOrder(id);
    setDeleteSupplyDialogOpen(false);
    setOrderToDelete(null);
    toast({
      title: tr("Bon de sortie supprimé", "تم حذف سند الخروج"),
      description: tr("Le stock a été rétabli et le bon de sortie supprimé", "تمت استعادة المخزون وحذف سند الخروج"),
    });
  };

  const handleDeleteReturnOrder = (id: string) => {
    deleteReturnOrder(id);
    setDeleteReturnDialogOpen(false);
    setOrderToDelete(null);
    toast({
      title: tr("Bon d'Entrée supprimé", "تم حذف سند الدخول"),
      description: tr("Le bon d'Entrée a été supprimé avec succès", "تم حذف سند الدخول بنجاح"),
    });
  };

  // Payment dialog functions
  const calculatePaymentTotals = () => {
    if (!selectedReturnOrderForPayment || !selectedReturnOrderForPayment.items) {
      return { subtotal: 0, taxAmount: 0, total: 0 };
    }
    
    // Find the original supply order to get unit prices
    const originalSupplyOrder = supplyOrders.find(order =>
      order.id === selectedReturnOrderForPayment.supplyOrderId
    );

    if (!originalSupplyOrder) {
      return { subtotal: 0, taxAmount: 0, total: 0 };
    }

    // رسوم الـ Consigne حسب نوع القنينة
    const CONSIGNE_FEES: Record<string, number> = {
      'Butane 12KG': 50,
      'Butane 6KG': 40,
      'Butane 3KG': 30,
    };

    const subtotal = selectedReturnOrderForPayment.items.reduce((sum: number, item: any) => {
      // Find the original item to get unit price
      const originalItem = originalSupplyOrder.items.find((origItem: any) =>
        origItem.bottleTypeId === item.bottleTypeId
      );

      if (!originalItem) return sum;

      // Calculate sold quantity based on returned empty + consigne
      const soldQuantity = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);

      const amount = soldQuantity * (originalItem.unitPrice || 0);
      return sum + amount;
    }, 0);

    const taxRate = 10; // 10% TVA
    const taxAmount = subtotal * (taxRate / 100);

    // إجمالي رسوم الـ Consigne تُضاف مباشرة إلى Montant Total
    const consigneFeesTotal = selectedReturnOrderForPayment.items.reduce((sum: number, item: any) => {
      const fee = CONSIGNE_FEES[item.bottleTypeName] || 0;
      const q = item.consigneQuantity || 0;
      return sum + (q * fee);
    }, 0);

    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total, consigneFeesTotal };
  };

  const calculatePaymentDebt = () => {
    const { total } = calculatePaymentTotals();
    const cash = parseFloat(paymentCashAmount) || 0;
    const check = parseFloat(paymentCheckAmount) || 0;
    const mygaz = parseFloat(paymentMygazAmount) || 0;
    return Math.max(0, total - (cash + check + mygaz));
  };

  const calculateNetToPay = () => {
    const { total } = calculatePaymentTotals();
    const cash = parseFloat(paymentCashAmount) || 0;
    const check = parseFloat(paymentCheckAmount) || 0;
    const mygaz = parseFloat(paymentMygazAmount) || 0;
    return Math.max(0, total - (cash + check + mygaz));
  };

  const handlePaymentSubmit = () => {
    if (!selectedReturnOrderForPayment) return;

    const { total, subtotal, taxAmount } = calculatePaymentTotals();
    const cash = parseFloat(paymentCashAmount) || 0;
    const check = parseFloat(paymentCheckAmount) || 0;
    const mygaz = parseFloat(paymentMygazAmount) || 0;
    const totalPaid = cash + check + mygaz;
    const debt = calculatePaymentDebt();

    // Add revenue entry
    addRevenue({
      date: new Date().toISOString(),
      description: `Règlement B.D ${selectedReturnOrderForPayment.orderNumber}`,
      amount: totalPaid,
      paymentMethod: (cash > 0 || check > 0 || mygaz > 0) ? 'mixed' : 'cash',
      cashAmount: cash,
      checkAmount: check,
      mygazAmount: mygaz,
      relatedOrderId: selectedReturnOrderForPayment.id,
      relatedOrderType: 'return'
    });

    // Update driver debt if there's remaining debt and a driver is assigned
    // Use the exact remaining debt (Dette Restante) from the settlement
    if (debt > 0 && selectedReturnOrderForPayment.driverId) {
      updateDriverDebt(selectedReturnOrderForPayment.driverId, debt);
    }

    // Reset form and close dialog
    setPaymentCashAmount('');
    setPaymentCheckAmount('');
    setPaymentMygazAmount('');
    setPaymentDialogOpen(false);
    setSelectedReturnOrderForPayment(null);

    toast({
      title: tr("Règlement enregistré", "تم تسجيل التسوية"),
      description: language === 'ar'
        ? `تم تسجيل دفع بقيمة ${(Number(cash + check + mygaz) || 0).toFixed(2)} DH بنجاح${debt > 0 ? `. تمت إضافة دين بقيمة ${(Number(debt) || 0).toFixed(2)} DH للسائق.` : '.'}`
        : `Paiement de ${(Number(cash + check + mygaz) || 0).toFixed(2)} DH enregistré avec succès${debt > 0 ? `. Dette de ${(Number(debt) || 0).toFixed(2)} DH ajoutée au chauffeur.` : '.'}`,
    });
  };

  const resetPaymentDialog = () => {
    setPaymentCashAmount('');
    setPaymentCheckAmount('');
    setPaymentMygazAmount('');
    setSelectedReturnOrderForPayment(null);
  };
  const getReturnPaymentInfo = (order: any) => {
    if (!order) return null;
    let parsed: any = null;
    if (order.note) {
      if (typeof order.note === 'string') {
        try {
          parsed = JSON.parse(order.note);
        } catch {
          parsed = null;
        }
      } else if (typeof order.note === 'object') {
        parsed = order.note;
      }
    }
    const cash = Number(parsed?.cash ?? order.paymentCash ?? order.payment_cash ?? 0);
    const check = Number(parsed?.check ?? order.paymentCheque ?? order.payment_cheque ?? 0);
    const mygaz = Number(parsed?.mygaz ?? order.paymentMygaz ?? order.payment_mygaz ?? 0);
    const debt = Number(parsed?.debt ?? order.paymentDebt ?? order.payment_debt ?? 0);
    const total = Number(parsed?.total ?? order.paymentTotal ?? order.payment_total ?? 0);
    const subtotal = Number(parsed?.subtotal ?? order.paymentSubtotal ?? order.payment_subtotal ?? 0);
    const taxAmount = Number(parsed?.taxAmount ?? order.paymentTaxAmount ?? order.payment_tax_amount ?? 0);
    const hasAny = [cash, check, mygaz, debt, total, subtotal, taxAmount].some((v) => Number(v) > 0);
    if (!hasAny) return null;
    return { cash, check, mygaz, debt, total, subtotal, taxAmount };
  };

  const handlePrintBD = (order: any) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      
      // Colors & Styles
      const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const lightGray = [248, 250, 252]; // Slate-50

      // Header Background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 45, 'F');

      // Brand & Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text(t('brand', 'SFT GAZ'), 14, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(tsr('systemTitle', 'SYSTÈME DE GESTION DE DISTRIBUTION'), 14, 32);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(tsr('bdTitle', "BON D'ENTRÉE (B.D)"), 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N° ${order.orderNumber}`, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      
      // Card 1: Order Details
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');
      // Card 2: Driver/Client Info
      doc.roundedRect(106, 55, 90, 45, 2, 2, 'FD');

      const drawInfoLabel = (label: string, value: string, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(value, x, y + 6);
      };

      // Card 1 Content
      drawInfoLabel(tsr('receptionDate', 'Date de réception'), format(new Date(order.date), 'dd MMMM yyyy HH:mm', { locale: fr }), 20, 68);
      drawInfoLabel(tsr('bsReference', 'Référence B.S'), order.supplyOrderNumber, 20, 85);

      // Card 2 Content
      if (order.driverName) {
        drawInfoLabel(tsr('driver', 'Chauffeur'), order.driverName, 112, 68);
      } else {
        drawInfoLabel(tsr('driver', 'Chauffeur'), tsr('notSpecified', 'Non spécifié'), 112, 68);
      }
      
      if (order.clientName) {
        drawInfoLabel(tsr('client', 'Client'), order.clientName, 112, 85);
      } else {
        drawInfoLabel(tsr('client', 'Client'), tsr('notSpecified', 'Non spécifié'), 112, 85);
      }

      // Products Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(tsr('returnDetails', 'Détails des Retours'), 14, 115);

      const tableData = (order.items || []).map(item => [
        item.bottleTypeName,
        (item.returnedEmptyQuantity || 0).toString(),
        (item.returnedFullQuantity || 0).toString(),
        (item.foreignQuantity || 0).toString(),
        (item.defectiveQuantity || 0).toString(),
        (item.consigneQuantity || 0).toString(),
        (item.lostQuantity || 0).toString(),
        ((item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0)).toString()
      ]);

      autoTable(doc, {
        startY: 120,
        head: [[tsr('product', 'Produit'), tsr('empty', 'Vides'), tsr('full', 'Pleines'), tsr('foreignShort', 'Étran.'), tsr('defectiveShort', 'Défec.'), tsr('consigneShort', 'Cons.'), tsr('rcShort', 'R.C'), tsr('sales', 'Ventes')]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          7: { halign: 'center', fontStyle: 'bold' }
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 120;
      let cursorY = finalY + 10;
      const paymentInfo = getReturnPaymentInfo(order);
      if (paymentInfo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(tsr('paymentTitle', 'Règlement du Retour'), 14, cursorY);
        cursorY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`${tsr('paymentCash', 'Espèces')}: ${(Number(paymentInfo.cash) || 0).toFixed(2)} DH`, 14, cursorY);
        cursorY += 4;
        doc.text(`${tsr('paymentCheque', 'Chèque')}: ${(Number(paymentInfo.check) || 0).toFixed(2)} DH`, 14, cursorY);
        cursorY += 4;
        doc.text(`${tsr('paymentMygaz', 'MYGAZ')}: ${(Number(paymentInfo.mygaz) || 0).toFixed(2)} DH`, 14, cursorY);
        cursorY += 4;
        doc.text(`${tsr('paymentDebt', 'Dette Restante')}: ${(Number(paymentInfo.debt) || 0).toFixed(2)} DH`, 14, cursorY);
        cursorY += 4;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`${tsr('paymentTotal', 'Montant Total du Bon')}: ${(Number(paymentInfo.total) || 0).toFixed(2)} DH`, 14, cursorY);
        cursorY += 6;
      }

      const legendY = cursorY + 4;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text(tsr('legend', 'LÉGENDE:'), 14, legendY);
      
      doc.setFont('helvetica', 'normal');
      const legends = [
        tsr('legendEmpty', 'Vides: Bouteilles vides retournées'),
        tsr('legendFull', 'Pleines: Bouteilles pleines retournées'),
        tsr('legendForeign', "Étran.: Bouteilles d'autres fournisseurs"),
        tsr('legendDefective', 'Défec.: Bouteilles endommagées'),
        tsr('legendConsigne', 'Cons.: Bouteilles vendues sans échange'),
        tsr('legendRc', 'R.C: Bouteilles non retournées (dette chauffeur)'),
        tsr('legendSales', 'Ventes: Vides + Consigne')
      ];
      
      legends.forEach((text, index) => {
        doc.text(`- ${text}`, 14, legendY + 5 + (index * 4));
      });

      // Signature area
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(tsr('managerSignature', 'Signature du Responsable'), 140, legendY + 20);
      doc.line(140, legendY + 22, 196, legendY + 22);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${tsr('autoGeneratedBy', 'Document généré automatiquement par SFT GAZ le')} ${format(now, 'dd/MM/yyyy à HH:mm')}`,
          14,
          282
        );
        doc.text(
          `${tsr('page', 'Page')} ${i} / ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`BD_${order.orderNumber}_${format(new Date(order.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur PDF:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du PDF",
        variant: "destructive"
      });
    }
  };
  
  const { subtotal, taxAmount, total } = calculateTotals();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-page-shell p-4 md:p-8 space-y-8 bg-gradient-to-b from-indigo-50/60 via-slate-50 to-white min-h-screen"
    >
      <div className="rounded-3xl border border-indigo-100 bg-white/80 backdrop-blur-xl shadow-lg shadow-indigo-100/60 p-4 md:p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-md">
                <Package className="w-6 h-6" />
              </div>
              <h1 className="app-page-title text-3xl font-black tracking-tight text-slate-900">
                {tr("Supply & Return Studio", "استوديو التوريد والإرجاع")}
              </h1>
            </div>
            <p className="app-page-subtitle text-slate-500">
              {tr("Interface premium pour piloter bons de sortie, retours et encaissements", "واجهة احترافية لقيادة سندات الخروج والإرجاع والتحصيلات.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 border-indigo-200 text-indigo-700 bg-indigo-50">
              {tr('N° Suivant', 'الرقم التالي')}: {orderNumber}
            </Badge>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
            <p className="text-[11px] uppercase tracking-wider text-indigo-700 font-bold">
              {tr("B.S filtrés", "B.S مفلترة")}
            </p>
            <p className="text-2xl font-black text-indigo-900 mt-1">{filteredOrders.length}</p>
            <p className="text-xs text-indigo-600 mt-1">
              {tr("Sorties validées", "سندات خروج مُصدَّقة")}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold">
              {tr("B.D filtrés", "B.D مفلترة")}
            </p>
            <p className="text-2xl font-black text-emerald-900 mt-1">{filteredReturnOrders.length}</p>
            <p className="text-xs text-emerald-600 mt-1">
              {tr("Retours enregistrés", "مرتجعات مسجَّلة")}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3">
            <p className="text-[11px] uppercase tracking-wider text-violet-700 font-bold">
              {tr("Montant B.S", "مبلغ B.S")}
            </p>
            <p className="text-xl font-black text-violet-900 mt-1">{dashboardStats.totalSupplyAmount.toFixed(2)} DH</p>
            <p className="text-xs text-violet-600 mt-1">
              {tr("Volume sur filtres actifs", "حجم وفق الفلاتر النشطة")}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
            <p className="text-[11px] uppercase tracking-wider text-amber-700 font-bold">
              {tr("Paiements", "المدفوعات")}
            </p>
            <p className="text-xl font-black text-amber-900 mt-1">{dashboardStats.paidReturns}/{filteredReturnOrders.length}</p>
            <p className="text-xs text-amber-600 mt-1">
              {tr("Réglés / total B.D", "المسدَّد / إجمالي B.D")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-700 font-bold">
              {tr("Activité jour", "نشاط اليوم")}
            </p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {dashboardStats.supplyToday} <ArrowUpRight className="inline w-4 h-4 text-indigo-600" /> / {dashboardStats.returnsToday} <ArrowDownLeft className="inline w-4 h-4 text-emerald-600" />
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {tr("Sorties / retours du jour", "الخروج / الإرجاع اليومي")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Settings className="w-4 h-4 mr-1" />
              {tr('Options d\'affichage', 'خيارات العرض')}
            </Button>
          </DropdownMenuTrigger>
          <Badge className="ml-2 bg-slate-100 text-slate-700 border-slate-200">{displayedSectionsCount}/3</Badge>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{tr('Sections', 'الأقسام')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showQuickActions} onCheckedChange={(v) => setShowQuickActions(Boolean(v))}>
              {tr('Quick Actions', 'إجراءات سريعة')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showTimeline} onCheckedChange={(v) => setShowTimeline(Boolean(v))}>
              {tr('Timeline opérationnel', 'الخط الزمني التشغيلي')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showAnomaly} onCheckedChange={(v) => setShowAnomaly(Boolean(v))}>
              {tr('Anomaly Engine', 'محرك الشذوذ')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setShowQuickActions(true); setShowTimeline(true); setShowAnomaly(true); }}>
              <Eye className="w-4 h-4 mr-2" /> {tr('Tout afficher', 'إظهار الكل')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setShowQuickActions(false); setShowTimeline(false); setShowAnomaly(false); }}>
              <EyeOff className="w-4 h-4 mr-2" /> {tr('Tout masquer', 'إخفاء الكل')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {!showQuickActions ? (
          <Card className="xl:col-span-4 border border-slate-200/80 bg-white/95 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2 text-slate-800">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  {tr("Quick Actions", "إجراءات سريعة")}
                </span>
                <Button size="sm" variant="outline" onClick={() => setShowQuickActions(true)} className="h-7 py-0">
                  <Eye className="w-4 h-4 mr-1" /> {tr('Afficher', 'إظهار')}
                </Button>
              </CardTitle>
            </CardHeader>
          </Card>
        ) : (
        <Card className="xl:col-span-4 border border-slate-200/80 bg-white/95 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2 text-slate-800">
              <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              {tr("Quick Actions", "إجراءات سريعة")}
              </span>
              <div className="flex items-center gap-2">
              <Badge className={
                adaptiveRisk.level === 'high'
                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200'
                  : adaptiveRisk.level === 'medium'
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
              }>
                {adaptiveRisk.label}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setShowQuickActions(false)} className="h-7 py-0">
                <EyeOff className="w-4 h-4 mr-1" /> {tr('Masquer', 'إخفاء')}
              </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {adaptiveQuickActions.map((action) => (
              <div key={action.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                <Button
                  type="button"
                  variant={action.tone === 'indigo' ? 'default' : 'outline'}
                  disabled={action.disabled}
                  className={
                    action.tone === 'indigo'
                      ? 'w-full justify-start bg-indigo-600 hover:bg-indigo-700 text-white'
                      : action.tone === 'emerald'
                      ? 'w-full justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      : action.tone === 'amber'
                      ? 'w-full justify-start border-amber-200 text-amber-700 hover:bg-amber-50'
                      : 'w-full justify-start'
                  }
                  onClick={() => runQuickAction(action.id)}
                >
                  {action.id === 'create-bs' ? <Plus className="w-4 h-4 mr-2" /> : action.id === 'quick-return' ? <RotateCcw className="w-4 h-4 mr-2" /> : action.id === 'open-payment' ? <DollarSign className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  {action.label}
                </Button>
                <p className="text-[11px] text-slate-500 mt-1.5 px-1">{action.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        )}

        {!showTimeline ? (
          <Card className="xl:col-span-5 border border-slate-200/80 bg-white/95 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2 text-slate-800">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  {tr("Timeline opérationnel", "الخط الزمني التشغيلي")}
                </span>
                <Button size="sm" variant="outline" onClick={() => setShowTimeline(true)} className="h-7 py-0">
                  <Eye className="w-4 h-4 mr-1" /> {tr('Afficher', 'إظهار')}
                </Button>
              </CardTitle>
            </CardHeader>
          </Card>
        ) : (
        <Card className="xl:col-span-5 border border-slate-200/80 bg-white/95 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2 text-slate-800">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-600" />
                {tr("Timeline opérationnel", "الخط الزمني التشغيلي")}
              </span>
              <Button size="sm" variant="outline" onClick={() => setShowTimeline(false)} className="h-7 py-0">
                <EyeOff className="w-4 h-4 mr-1" /> {tr('Masquer', 'إخفاء')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commandTimeline.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 text-sm">
                {tr("Aucun mouvement pour la période actuelle", "لا توجد حركات للفترة الحالية")}
              </div>
            ) : (
              commandTimeline.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-100 p-3 flex items-start justify-between gap-3 bg-slate-50/55">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={event.kind === 'supply' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'}>
                        {event.kind === 'supply' ? tr('Sortie', 'خروج') : tr('Retour', 'إرجاع')}
                      </Badge>
                      <p className="font-bold text-slate-900 truncate">{event.title}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{event.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900">{event.amountLabel}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(event.date).toLocaleString(uiLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        )}

        {!showAnomaly ? (
          <Card className="xl:col-span-3 border border-slate-200/80 bg-white/95 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2 text-slate-800">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {tr("Anomaly Engine", "محرك الشذوذ")}
                </span>
                <Button size="sm" variant="outline" onClick={() => setShowAnomaly(true)} className="h-7 py-0">
                  <Eye className="w-4 h-4 mr-1" /> {tr('Afficher', 'إظهار')}
                </Button>
              </CardTitle>
            </CardHeader>
          </Card>
        ) : (
        <Card className="xl:col-span-3 border border-slate-200/80 bg-white/95 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2 text-slate-800">
              <span className="flex items-center gap-2">
              <AlertTriangle className={adaptiveRisk.level === 'high' ? 'w-4 h-4 text-rose-600' : adaptiveRisk.level === 'medium' ? 'w-4 h-4 text-amber-600' : 'w-4 h-4 text-emerald-600'} />
              {tr("Anomaly Engine", "محرك الشذوذ")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">{adaptiveRisk.score}/100</span>
                <Button size="sm" variant="outline" onClick={() => setShowAnomaly(false)} className="h-7 py-0">
                  <EyeOff className="w-4 h-4 mr-1" /> {tr('Masquer', 'إخفاء')}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={adaptiveRisk.level === 'high' ? 'h-full bg-rose-500' : adaptiveRisk.level === 'medium' ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
                  style={{ width: `${adaptiveRisk.score}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-1.5">{adaptiveRisk.label}</p>
            </div>
            {anomalySignals.map((signal) => (
              <div
                key={signal.id}
                className={`rounded-xl border p-3 ${
                  signal.level === 'high'
                    ? 'border-rose-200 bg-rose-50/70'
                    : signal.level === 'medium'
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-emerald-200 bg-emerald-50/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{signal.title}</p>
                  <p className="text-lg font-black text-slate-900">{signal.value}</p>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">{signal.hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Selection & Products */}
        <div className="lg:col-span-2 space-y-8">
          <Card id="command-create-bs" className="border border-slate-200/70 shadow-sm bg-white/95 overflow-hidden rounded-2xl">
            <div className={cn("h-1", sectionTone.configBar)} />
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  {tr("Configuration du Bon", "تهيئة السند")}
                </span>
                <Badge className={configInsight.score >= 90 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : configInsight.score >= 50 ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200'}>
                  {configInsight.score}% · {configInsight.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <div className="w-full h-2 rounded-full bg-indigo-100 overflow-hidden">
                  <div className={configInsight.score >= 90 ? 'h-full bg-emerald-500' : configInsight.score >= 50 ? 'h-full bg-amber-500' : 'h-full bg-indigo-500'} style={{ width: `${configInsight.score}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg bg-white/80 border border-indigo-100 px-2 py-1.5 text-slate-700">
                    {tr("Mode", "الوضع")}: <span className="font-bold">{selectionType}</span>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-indigo-100 px-2 py-1.5 text-slate-700">
                    {tr("Produits", "المنتجات")}: <span className="font-bold">{items.length}</span>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-indigo-100 px-2 py-1.5 text-slate-700">
                    {tr("Réf", "مرجع")}: <span className="font-bold">{reference ? tr("Oui", "نعم") : tr("Non", "لا")}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{tr("Type de Destinataire", "نوع المستلم")}</Label>
                  <Select value={selectionType} onValueChange={(value: any) => setSelectionType(value)}>
                    <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">{tr("Chauffeur / Client existant", "سائق / زبون موجود")}</SelectItem>
                      <SelectItem value="new-driver">{tr("Nouveau chauffeur", "سائق جديد")}</SelectItem>
                      <SelectItem value="new-client">{tr("Nouveau client", "زبون جديد")}</SelectItem>
                      <SelectItem value="petit-camion">{tr("Allogaz", "ألوغاز")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-right">{tr("N° Bon de Sortie", "رقم سند الخروج")}</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      value={orderNumber} 
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="pl-10 border-slate-200 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{tr("Date du Bon", "تاريخ السند")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-11 bg-white border-slate-200 rounded-xl justify-start text-left font-medium shadow-sm hover:bg-slate-50 transition-all",
                          !orderDate && "text-slate-500"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-indigo-600" />
                        {orderDate ? (
                          formatDateUi(orderDate, { day: '2-digit', month: 'long', year: 'numeric' })
                        ) : (
                          <span>{tr("Choisir une date", "اختر تاريخًا")}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={orderDate}
                        onSelect={(date) => date && setOrderDate(date)}
                        initialFocus
                        locale={language === 'ar' ? undefined : fr}
                        className="bg-white p-4"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {selectionType === 'petit-camion' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100"
                  >
                    <div className="font-semibold text-indigo-900 flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      {tsu('allogaz.details', 'Détails Allogaz')}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="petit-camion-select">{tsu('allogaz.label', 'Allogaz')}</Label>
                        <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                          <SelectTrigger id="petit-camion-select" className="bg-white border-indigo-200">
                            <SelectValue placeholder={tsu('allogaz.selectTruck', 'Sélectionner un camion')} />
                          </SelectTrigger>
                          <SelectContent>
                            {trucks.filter(t => t.truckType === 'petit-camion').length === 0 && (
                              <SelectItem disabled value="none">{tsu('allogaz.noneAvailable', 'Aucun Allogaz disponible')}</SelectItem>
                            )}
                            {trucks.filter(t => t.truckType === 'petit-camion').map(truck => {
                              const driver = drivers.find(d => d.id === truck.driverId);
                              return (
                                <SelectItem key={truck.id} value={truck.id}>
                                  {truck.matricule} - {driver?.name || tsu('common.noDriver', 'Sans chauffeur')}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="petit-camion-driver-select">{tsu('allogaz.assignedDriver', 'Chauffeur Assigné')}</Label>
                        <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                          <SelectTrigger id="petit-camion-driver-select" className="bg-white border-indigo-200">
                            <SelectValue placeholder={tsu('allogaz.selectDriver', 'Sélectionner un chauffeur')} />
                          </SelectTrigger>
                          <SelectContent>
                            {drivers.map(driver => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                        onClick={() => {
                          if (!selectedTruckId) {
                            toast({
                              title: tr("Sélection requise", "اختيار مطلوب"),
                              description: tr("Veuillez d'abord sélectionner un camion", "يرجى اختيار شاحنة أولاً"),
                              variant: "destructive"
                            });
                            return;
                          }
                          setSupplyTruckDialogOpen(true);
                        }}
                      >
                        <Truck className="w-4 h-4 mr-2" />
                        {tr('Gérer le chargement détaillé du camion', 'إدارة تحميل الشاحنة بالتفصيل')}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {selectionType === 'existing' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">{tr("Chauffeur", "السائق")}</Label>
                      <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                        <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder={tr("Sélectionner un chauffeur", "اختر سائقًا")} />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map(driver => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">{tr("Client", "الزبون")}</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder={tr("Sélectionner un client", "اختر زبونًا")} />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}

                {(selectionType === 'new-driver' || selectionType === 'new-client') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">
                        {selectionType === 'new-driver'
                          ? tr('Matricule du Camion', 'ترقيم الشاحنة')
                          : tr('Nom du Client', 'اسم الزبون')}
                      </Label>
                      <Input
                        placeholder={selectionType === 'new-driver' ? tr("Ex: 12345-A-67", "مثال: 12345-A-67") : tr("Nom du client", "اسم الزبون")}
                        value={selectionType === 'new-driver' ? newDriverMatricule : newClientName}
                        onChange={(e) => selectionType === 'new-driver' ? setNewDriverMatricule(e.target.value) : setNewClientName(e.target.value)}
                        className="border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-700 font-medium">{tr("Référence Interne (Optionnel)", "مرجع داخلي (اختياري)")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInternalReference((prev) => !prev)}
                    className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                  >
                    {showInternalReference ? tr("Masquer", "إخفاء") : tr("Afficher", "إظهار")}
                  </Button>
                </div>
                {showInternalReference && (
                  <div className="space-y-2">
                    <Input
                      placeholder={tr("Référence (ex: REF-2023-001)", "مرجع (مثال: REF-2023-001)")}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="border-slate-200 focus:ring-indigo-500"
                    />
                    {lastReference && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs text-slate-500">{tr("Dernière utilisée:", "آخر استخدام:")}</span>
                        <button 
                          type="button"
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                          onClick={() => setReference(lastReference)}
                        >
                          {lastReference}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!showInternalReference && reference && (
                  <div className="text-xs text-slate-500 px-1">
                    {tr("Référence sauvegardée:", "مرجع محفوظ:")} {reference}
                  </div>
                )}
                {!showInternalReference && !reference && (
                  <div className="text-xs text-slate-400 px-1">
                    {tr("Champ masqué", "حقل مخفي")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/70 shadow-sm bg-white/95 overflow-hidden rounded-2xl">
            <div className={cn("h-1", sectionTone.productBar)} />
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                {tr("Sélection des Produits", "اختيار المنتجات")}
              </CardTitle>
              <Badge variant="secondary" className={productInsight.health === 'high' ? 'bg-rose-50 text-rose-700 border-rose-100' : productInsight.health === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}>
                {productInsight.selectedTypes} {tr('types actifs', 'أنواع نشطة')}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold">
                    {tr("Volume sélectionné", "الحجم المحدد")}
                  </p>
                  <p className="text-lg font-black text-emerald-900 mt-0.5">{productInsight.selectedVolume}</p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-700 font-bold">
                    {tr("Types sélectionnés", "الأنواع المحددة")}
                  </p>
                  <p className="text-lg font-black text-indigo-900 mt-0.5">
                    {productInsight.selectedTypes} {tr("types actifs", "أنواع نشطة")}
                  </p>
                </div>
                <div className={cn("rounded-xl border p-2.5", productInsight.lowWarehouseTypes > 0 ? "border-amber-100 bg-amber-50/70" : "border-slate-200 bg-slate-50/70")}>
                  <p className={cn("text-[11px] uppercase tracking-wide font-bold", productInsight.lowWarehouseTypes > 0 ? "text-amber-700" : "text-slate-700")}>
                    {tr("Stock usine sensible", "مخزون المصنع الحساس")}
                  </p>
                  <p className={cn("text-lg font-black mt-0.5", productInsight.lowWarehouseTypes > 0 ? "text-amber-900" : "text-slate-900")}>{productInsight.lowWarehouseTypes}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="flex items-center justify-start gap-2 pb-6 pt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="group relative h-12 min-w-[320px] justify-between border-emerald-200/50 bg-gradient-to-r from-emerald-50/50 via-white to-indigo-50/50 text-slate-900 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-100/20 via-transparent to-indigo-100/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
                        <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-200" />
                        <span className="flex items-center gap-3 text-[15px] font-bold z-10">
                          <div className="p-1.5 bg-emerald-100/50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                            <Sparkles className="h-4 w-4 text-emerald-600 group-hover:animate-pulse" />
                          </div>
                          <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                            {selectedBottleTypeIds.size === 0
                              ? tr('Sélectionner un produit dans la liste', 'اختر منتجًا من القائمة')
                              : [...selectedBottleTypeIds].map(id => sortedBottleTypes.find(b => b.id === id)?.name).filter(Boolean).join(', ')}
                          </span>
                        </span>
                        <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-white transition-colors z-10">
                          <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[340px] p-3 rounded-2xl shadow-2xl border-slate-100 bg-white/95 backdrop-blur-xl" align="start">
                      <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, type: 'spring', bounce: 0.5 }}>
                        <div className="mb-3 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            value={bottleTypeQuery}
                            onChange={(e) => setBottleTypeQuery(e.target.value)}
                            placeholder={tr('Rechercher un produit...', 'ابحث عن منتج...')}
                            className="h-10 pl-9 border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 transition-all rounded-xl"
                          />
                        </div>
                        <div className="max-h-[320px] overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                          {filteredBottleTypes.map((bt, idx) => {
                            const checked = selectedBottleTypeIds.has(bt.id);
                            return (
                              <motion.label 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                key={bt.id} 
                                className={cn(
                                  "flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all cursor-pointer border border-transparent",
                                  checked 
                                    ? "bg-emerald-50/80 border-emerald-100 shadow-sm" 
                                    : "hover:bg-slate-50 hover:border-slate-100"
                                )}
                              >
                                <div className={cn(
                                  "flex items-center justify-center w-5 h-5 rounded-md border transition-all",
                                  checked 
                                    ? "bg-emerald-500 border-emerald-600 text-white" 
                                    : "border-slate-300 bg-white"
                                )}>
                                  {checked && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-3.5 h-3.5" /></motion.div>}
                                </div>
                                <Checkbox
                                  checked={checked}
                                  className="hidden"
                                  onCheckedChange={(v) => {
                                    setSelectedBottleTypeIds(prev => {
                                      const next = new Set(prev);
                                      if (v) next.add(bt.id); else next.delete(bt.id);
                                      return next;
                                    });
                                  }}
                                />
                                <div className="flex flex-col">
                                  <span className={cn("text-sm font-semibold transition-colors", checked ? "text-emerald-900" : "text-slate-700")}>{bt.name}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{bt.capacity}</span>
                                </div>
                              </motion.label>
                            );
                          })}
                        </div>
                        {selectedBottleTypeIds.size > 0 && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                            <div className="flex flex-wrap gap-1.5">
                              {[...selectedBottleTypeIds].slice(0, 2).map(id => {
                                const name = sortedBottleTypes.find(b => b.id === id)?.name;
                                if (!name) return null;
                                return <Badge key={id} className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold">{name}</Badge>;
                              })}
                              {selectedBottleTypeIds.size > 2 && (
                                <Badge variant="outline" className="bg-slate-50 text-slate-600 font-bold border-slate-200">+{selectedBottleTypeIds.size - 2}</Badge>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedBottleTypeIds(new Set())} className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 px-2 rounded-lg font-semibold">
                              <RefreshCw className="w-3 h-3 mr-1.5" />
                              {tr('Réinitialiser', 'إعادة تعيين')}
                            </Button>
                          </motion.div>
                        )}
                      </motion.div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="font-semibold text-slate-700">
                        {tr("Type de Bouteille", "نوع القنينة")}
                      </TableHead>
                      <TableHead className="text-center font-semibold text-slate-700">{tr('Pleines (Sortie)', 'ممتلئة (خروج)')}</TableHead>
                      <TableHead className="text-center font-semibold text-slate-700">{tr('Stock Dépôt', 'مخزون المستودع')}</TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">{tr('Prix Unitaire', 'السعر الوحدوي')}</TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">{tr('Total', 'الإجمالي')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedBottleTypeIds.size > 0 ? sortedBottleTypes.filter(bt => selectedBottleTypeIds.has(bt.id)) : []).map((bt, idx) => {
                      const currentItem = items.find(i => i.bottleTypeId === bt.id);
                      const fullQty = currentItem?.fullQuantity ?? 0;
                      const amount = currentItem?.amount ?? 0;

                      return (
                        <motion.tr 
                          key={bt.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          <TableCell className="py-4">
                            <div className="font-semibold text-slate-900">{bt.name}</div>
                            <div className="text-xs text-slate-500">{bt.capacity}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min={0}
                                max={getWarehouseFull(bt)}
                                value={fullQty === 0 ? '' : fullQty}
                                placeholder={tr('Entrez quantité', 'أدخل الكمية')}
                                onChange={(e) => handleQuantityChange(bt.id, 'full', e.target.value)}
                                className={cn(
                                  "w-20 mx-auto text-center border-slate-200 focus:ring-indigo-500 font-medium",
                                  fullQty > 0 && "text-indigo-600 border-indigo-200 bg-indigo-50/30"
                                )}
                              />
                              <div className="text-[10px] text-slate-400 font-medium">
                                {tr('Limite', 'الحد')}: {getWarehouseFull(bt)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              "font-mono",
                              getWarehouseFull(bt) < 10 ? "text-red-600 bg-red-50 border-red-100" : "text-slate-600"
                            )}>
                              {getWarehouseFull(bt)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-600">
                            {(Number(bt.unitPrice) || 0).toFixed(2)} DH
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            {(Number(amount) || 0).toFixed(2)} DH
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                    {selectedBottleTypeIds.size === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                          {tr('Sélectionner un produit dans la liste', 'اختر منتجًا من القائمة')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary & Actions */}
        <div className="space-y-8">
          <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-800 text-white overflow-hidden sticky top-8 rounded-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Calculator className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardTitle className="text-xl flex items-center justify-between gap-2">
                <span>{tr("Récapitulatif Financier", "الملخص المالي")}</span>
                <Badge className="bg-white/15 text-white hover:bg-white/15 border-white/20">
                  {Math.round(financialInsight.paymentCoverage * 100)}% {tr("couverture", "تغطية")}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/10 border border-white/15 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-100 font-bold">
                    {tr("Ticket moyen B.S", "متوسط تذكرة B.S")}
                  </p>
                  <p className="text-lg font-black text-white mt-0.5">{financialInsight.averageTicket.toFixed(2)} DH</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/15 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-100 font-bold">
                    {tr("Statut encaissement", "حالة التحصيل")}
                  </p>
                  <p className={cn("text-sm font-bold mt-1", sectionTone.financialAccent)}>{financialInsight.paymentLabel}</p>
                </div>
              </div>
                <div className="rounded-xl border border-white/15 bg-white/10 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-indigo-100 font-bold">
                    <span>{tr("Indice de couverture règlements", "مؤشر تغطية التسويات")}</span>
                    <span>{Math.round(financialInsight.paymentCoverage * 100)}%</span>
                  </div>
                <div className="w-full h-2 rounded-full bg-white/15 mt-2 overflow-hidden">
                  <div className={cn("h-full", financialInsight.paymentCoverage >= 0.75 ? "bg-emerald-400" : financialInsight.paymentCoverage >= 0.45 ? "bg-amber-300" : "bg-rose-300")} style={{ width: `${Math.round(financialInsight.paymentCoverage * 100)}%` }} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="text-indigo-200">{tr("Sous-total HT", "المجموع بدون ضريبة")}</span>
                  <span className="text-lg font-medium">{(Number(subtotal) || 0).toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="text-indigo-200">{tr("TVA (10%)", "الضريبة على القيمة المضافة (10%)")}</span>
                  <span className="text-lg font-medium">{(Number(taxAmount) || 0).toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xl font-bold">{tr("Total TTC", "الإجمالي مع الضريبة")}</span>
                  <span className="text-3xl font-black text-emerald-400">{(Number(total) || 0).toFixed(2)} DH</span>
                </div>
              </div>

              <div className="pt-6 space-y-4">
                <Button 
                  onClick={handleSubmit} 
                  disabled={items.length === 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-none h-12 text-lg font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {tr("Valider le Bon de Sortie", "تأكيد سند الخروج")}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setItems([]);
                    resetPaymentForm();
                  }}
                  className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white h-10"
                >
                  {tr("Réinitialiser", "إعادة التهيئة")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100 rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {tr("Détails de Session", "تفاصيل الجلسة")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-xs text-amber-800">
                <span>{tr("Date de Création", "تاريخ الإنشاء")}</span>
                <span className="font-semibold">{formatDateUi(new Date(), { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-800">
                <span>{tr("Heure", "الوقت")}</span>
                <span className="font-semibold">{format(new Date(), 'HH:mm')}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Sections */}
      <div id="command-history" className="space-y-8 pt-8 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg text-white">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{tsu('history.title', 'Gestion des Historiques')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">{tsu('history.bsFlow', 'Flux B.S')}</p>
            <p className="text-2xl font-black text-indigo-900 mt-1">{filteredOrders.length}</p>
            <p className="text-xs text-indigo-600 mt-1">{tsu('history.bsVisible', 'bons visibles dans l’historique')}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{tsu('history.bdFlow', 'Flux B.D')}</p>
            <p className="text-2xl font-black text-emerald-900 mt-1">{filteredReturnOrders.length}</p>
            <p className="text-xs text-emerald-600 mt-1">{tsu('history.bdVisible', 'retours visibles dans l’historique')}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">{tsu('history.pendingSettlement', 'En attente règlement')}</p>
            <p className="text-2xl font-black text-amber-900 mt-1">{dashboardStats.pendingReturns}</p>
            <p className="text-xs text-amber-600 mt-1">{tsu('history.unpaidBd', 'bons d’entrée non réglés')}</p>
          </div>
        </div>
        <div className={cn(
          "rounded-2xl border p-3",
          historyInsight.status === 'balanced'
            ? "border-emerald-100 bg-emerald-50/60"
            : historyInsight.status === 'supply-dominant'
            ? "border-indigo-100 bg-indigo-50/60"
            : "border-amber-100 bg-amber-50/60"
        )}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-700">{tsu('history.pulse48h', 'Pulse 48h')}</p>
            <Badge className={historyInsight.status === 'balanced' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : historyInsight.status === 'supply-dominant' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200'}>
              {historyInsight.status === 'balanced'
                ? tsu('history.balancedFlow', 'Flux équilibré')
                : historyInsight.status === 'supply-dominant'
                  ? tsu('history.supplyDominant', 'Sorties dominantes')
                  : tsu('history.returnDominant', 'Retours dominants')}
            </Badge>
          </div>
          <p className="text-sm text-slate-700 mt-1.5">
            {historyInsight.recentSupply} {tsu('history.bsRecent', 'B.S récents')} · {historyInsight.recentReturn} {tsu('history.bdRecent', 'B.D récents')}
          </p>
        </div>

        {/* Supply History */}
        <Card className="border border-slate-200/70 shadow-sm bg-white/95 overflow-hidden rounded-2xl">
          <Collapsible open={supplyHistoryOpen} onOpenChange={setSupplyHistoryOpen}>
            <CardHeader className="bg-white border-b border-slate-100 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {tsu('history.bsHistoryTitle', 'Historique des Bons de Sortie (B.S)')}
                <Badge className="ml-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-100">
                  {filteredOrders.length} {tsu('history.bons', 'bons')}
                </Badge>
                <Badge className="ml-1 bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200">
                  48h: {historyInsight.recentSupply}
                </Badge>
                {supplyFiltersActive && (
                  <Badge className="ml-1 bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
                    {tsu('history.activeFilters', 'Filtres actifs')}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {supplyFiltersActive && (
                  <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200" onClick={resetSupplyHistoryFilters}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    {tsu('history.resetFilters', 'Reset filtres')}
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-slate-100">
                    {supplyHistoryOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-indigo-700 font-bold">{tsu('history.bsFilteredFlow', 'Flux B.S filtré')}</p>
                    <p className="text-lg font-black text-indigo-900 mt-0.5">{filteredOrders.length}</p>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-violet-700 font-bold">{tsu('history.cumulativeAmount', 'Montant cumulé')}</p>
                    <p className="text-lg font-black text-violet-900 mt-0.5">{dashboardStats.totalSupplyAmount.toFixed(2)} DH</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-700 font-bold">{tsu('history.activeReference', 'Référence active')}</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{searchQuery ? tsu('history.searchFocused', 'Recherche ciblée') : tsu('history.globalView', 'Vue globale')}</p>
                  </div>
                </div>
                <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 rounded-xl p-3", supplyFiltersActive ? "bg-amber-50/50 border border-amber-100" : "bg-transparent")}>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.search', 'Recherche')}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder={tsu('history.searchBsPlaceholder', 'N° BS, Chauffeur...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.period', 'Période')}</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                            <Calendar className="mr-2 h-3.5 w-3.5" />
                            {startDate ? formatDateUi(startDate, { day: '2-digit', month: '2-digit' }) : tsu('history.from', 'Du')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} locale={language === 'ar' ? undefined : fr} />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                            <Calendar className="mr-2 h-3.5 w-3.5" />
                            {endDate ? formatDateUi(endDate, { day: '2-digit', month: '2-digit' }) : tsu('history.to', 'Au')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} locale={language === 'ar' ? undefined : fr} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.driver', 'Chauffeur')}</Label>
                    <Select value={filterDriver} onValueChange={setFilterDriver}>
                      <SelectTrigger className="border-slate-200 h-10">
                        <SelectValue placeholder={tsu('history.all', 'Tous')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tsu('history.allDrivers', 'Tous les chauffeurs')}</SelectItem>
                        {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.client', 'Client')}</Label>
                    <Select value={filterClient} onValueChange={setFilterClient}>
                      <SelectTrigger className="border-slate-200 h-10">
                        <SelectValue placeholder={tsu('history.all', 'Tous')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tsu('history.allClients', 'Tous les clients')}</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="font-bold">{tsu('history.bsNumber', 'N° BS')}</TableHead>
                        <TableHead className="font-bold">{tsu('history.dateTime', 'Date & Heure')}</TableHead>
                        <TableHead className="font-bold">{tsu('history.recipient', 'Destinataire')}</TableHead>
                        <TableHead className="font-bold">{tsu('history.products', 'Produits')}</TableHead>
                        <TableHead className="text-right font-bold">{tsu('history.totalTtc', 'Total TTC')}</TableHead>
                        <TableHead className="text-center font-bold">{tsu('history.actions', 'Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <Search className="w-8 h-8 opacity-20" />
                              {tsu('history.noBsFound', 'Aucun bon de sortie trouvé')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order, idx) => {
                          const relatedReturn = returnOrders.find((ret: any) => String(ret.supplyOrderId) === String(order.id));
                          return (
                          <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell>
                              <div className="font-mono font-bold text-indigo-600">{order.orderNumber}</div>
                              {order.reference && <div className="text-[10px] text-slate-400 uppercase tracking-tighter">REF: {order.reference}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-slate-700">{formatDateUi(order.date, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                              <div className="text-xs text-slate-400">{format(new Date(order.date), 'HH:mm')}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900">{order.driverName || tsu('common.noDriverCaps', 'Sans Chauffeur')}</span>
                                {order.clientName && <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3" /> {order.clientName}
                                </span>}
                                {order.truckId && (
                                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    <Truck className="w-3 h-3" /> {trucks.find(t => t.id === order.truckId)?.matricule}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] font-bold border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                onClick={() => {
                                  setSelectedSupplyOrder(order);
                                  setSupplyDetailsDialogOpen(true);
                                }}
                              >
                                {order.items.length} {tsu('history.gasTypes', 'TYPES DE GAZ')}
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-black text-slate-900">{(Number(order.total) || 0).toFixed(2)} DH</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1.5 justify-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                  onClick={() => handlePrintBS(order)}
                                  title={tsu('history.print', 'Imprimer')}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                {relatedReturn ? (
                                  <>
                                    <Badge className="h-8 px-2 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                      {tsu('history.paid', 'Réglé')}
                                    </Badge>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                      onClick={() => {
                                        setSelectedReturnOrder(relatedReturn);
                                        setReturnDetailsDialogOpen(true);
                                      }}
                                      title={tsu('history.details', 'Voir détails')}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                    onClick={() => {
                                      setSelectedSupplyOrder(order);
                                      setReturnDialogOpen(true);
                                    }}
                                    title={tsu('history.recordReturn', 'Enregistrer Retour')}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setOrderToDelete(order.id);
                                    setDeleteSupplyDialogOpen(true);
                                  }}
                                  title={tsu('history.delete', 'Supprimer')}
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
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Return History */}
        <Card id="command-return-history" className="border border-slate-200/70 shadow-sm bg-white/95 overflow-hidden rounded-2xl">
          <CardHeader className="bg-white border-b border-slate-100 flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {tsu('history.bdHistoryTitle', "Historique des Bons d'Entrée (B.D)")}
              <Badge className="ml-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100">
                {filteredReturnOrders.length} {tsu('history.returns', 'retours')}
              </Badge>
              <Badge className="ml-1 bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200">
                48h: {historyInsight.recentReturn}
              </Badge>
              {returnFiltersActive && (
                <Badge className="ml-1 bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
                  {tsu('history.activeFilters', 'Filtres actifs')}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {returnFiltersActive && (
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200" onClick={resetReturnHistoryFilters}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  {tsu('history.resetFilters', 'Reset filtres')}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                {tsu('history.export', 'Exporter')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200">
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    {tsu('history.options', 'Options')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{tsu('history.display', 'Affichage')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={true}>{tsu('history.standardColumns', 'Colonnes standards')}</DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{tsu('history.pagination', 'Pagination')}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value="10">
                    <DropdownMenuRadioItem value="10">{tsu('history.perPage10', '10 par page')}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="20">{tsu('history.perPage20', '20 par page')}</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold">{tsu('history.bdFilteredFlow', 'Flux B.D filtré')}</p>
                <p className="text-lg font-black text-emerald-900 mt-0.5">{filteredReturnOrders.length}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-amber-700 font-bold">{tsu('history.pendingPayments', 'Paiements en attente')}</p>
                <p className="text-lg font-black text-amber-900 mt-0.5">{dashboardStats.pendingReturns}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-700 font-bold">{tsu('history.filterState', 'État filtre')}</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{returnSearchQuery ? tsu('history.searchFocused', 'Recherche ciblée') : tsu('history.globalView', 'Vue globale')}</p>
              </div>
            </div>
            <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 rounded-xl p-3", returnFiltersActive ? "bg-amber-50/50 border border-amber-100" : "bg-transparent")}>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.search', 'Recherche')}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={tsu('history.searchBdPlaceholder', 'N° BD, N° BS...')}
                    value={returnSearchQuery}
                    onChange={(e) => setReturnSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.period', 'Période')}</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                        <Calendar className="mr-2 h-3.5 w-3.5" />
                        {returnStartDate ? formatDateUi(returnStartDate, { day: '2-digit', month: '2-digit' }) : tsu('history.from', 'Du')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={returnStartDate} onSelect={setReturnStartDate} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                        <Calendar className="mr-2 h-3.5 w-3.5" />
                        {returnEndDate ? formatDateUi(returnEndDate, { day: '2-digit', month: '2-digit' }) : tsu('history.to', 'Au')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={returnEndDate} onSelect={setReturnEndDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.driver', 'Chauffeur')}</Label>
                <Select value={returnFilterDriver} onValueChange={setReturnFilterDriver}>
                  <SelectTrigger className="border-slate-200 h-10">
                    <SelectValue placeholder={tsu('history.all', 'Tous')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tsu('history.allDrivers', 'Tous les chauffeurs')}</SelectItem>
                    {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tsu('history.client', 'Client')}</Label>
                <Select value={returnFilterClient} onValueChange={setReturnFilterClient}>
                  <SelectTrigger className="border-slate-200 h-10">
                    <SelectValue placeholder={tsu('history.all', 'Tous')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tsu('history.allClients', 'Tous les clients')}</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-bold">{tsu('history.bdNumber', 'N° B.D')}</TableHead>
                    <TableHead className="font-bold">{tsu('history.bsSource', 'B.S Source')}</TableHead>
                    <TableHead className="font-bold">{tsu('history.dateTime', 'Date & Heure')}</TableHead>
                    <TableHead className="font-bold">{tsu('history.driverClient', 'Chauffeur/Client')}</TableHead>
                    <TableHead className="text-center font-bold">{tsu('history.state', 'État')}</TableHead>
                    <TableHead className="text-center font-bold">{tsu('history.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturnOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <RotateCcw className="w-8 h-8 opacity-20" />
                          {tsu('history.noBdFound', "Aucun bon d'entrée trouvé")}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReturnOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <div className="font-mono font-bold text-emerald-600">{order.orderNumber}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] border-indigo-100 text-indigo-600 bg-indigo-50/30">
                            {order.supplyOrderNumber}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-slate-700">{formatDateUi(order.date, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="text-xs text-slate-400">{format(new Date(order.date), 'HH:mm')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">{order.driverName || tsu('common.na', 'N/A')}</span>
                            {order.clientName && <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{order.clientName}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {order.isPaid ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                              {tsu('history.paid', 'Réglé')}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                              {tsu('history.pending', 'Validé')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              onClick={() => handlePrintBD(order)}
                              title={tsu('history.print', 'Imprimer')}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              onClick={() => {
                                setSelectedReturnOrder(order);
                                setReturnDetailsDialogOpen(true);
                              }}
                              title={tsu('history.details', 'Détails')}
                            >
                              <Search className="w-4 h-4" />
                            </Button>
                            {!order.isPaid && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                onClick={() => {
                                  setSelectedReturnOrderForPayment(order);
                                  setPaymentDialogOpen(true);
                                }}
                                title={tsu('history.settlement', 'Règlement')}
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setOrderToDelete(order.id);
                                setDeleteReturnDialogOpen(true);
                              }}
                              title={tsu('history.delete', 'Supprimer')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
      </div>

      {returnDialogOpen && selectedSupplyOrder && (
        <RecordReturnDialog
          open={returnDialogOpen}
          onOpenChange={(open) => {
            setReturnDialogOpen(open);
            if (!open) {
              setSelectedSupplyOrder(null);
            }
          }}
          supplyOrder={selectedSupplyOrder}
        />
      )}

      {supplyTruckDialogOpen && selectedTruckId && trucks.find(t => t.id === selectedTruckId) && (
        <SupplyTruckDialog
          truck={trucks.find(t => t.id === selectedTruckId)!}
          open={supplyTruckDialogOpen}
          onOpenChange={setSupplyTruckDialogOpen}
        />
      )}

      {/* Delete Supply Order Confirmation Dialog */}
      <AlertDialog open={deleteSupplyDialogOpen} onOpenChange={setDeleteSupplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tsu('dialogs.deleteBsTitle', 'Êtes-vous sûr de vouloir supprimer ce bon de sortie ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tsu('dialogs.deleteBsDescription', 'Cette action ne peut pas être annulée. Cette action supprimera définitivement le bon de sortie.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tsu('history.cancel', 'Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => orderToDelete && handleDeleteSupplyOrder(orderToDelete)}>
              {tsu('history.delete', 'Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Return Order Confirmation Dialog */}
      <AlertDialog open={deleteReturnDialogOpen} onOpenChange={setDeleteReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tsu('dialogs.deleteBdTitle', 'Êtes-vous sûr de vouloir supprimer ce bon de retour ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tsu('dialogs.deleteBdDescription', 'Cette action ne peut pas être annulée. Cette action supprimera définitivement le bon de retour.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tsu('history.cancel', 'Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => orderToDelete && handleDeleteReturnOrder(orderToDelete)}>
              {tsu('history.delete', 'Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Supply Order Details Dialog */}
      <Dialog open={supplyDetailsDialogOpen} onOpenChange={setSupplyDetailsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{tsu('dialogs.bsDetailsTitle', 'Détails du Bon de Sortie N°')}{selectedSupplyOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              {selectedSupplyOrder && (
                <>
                  {tsu('history.date', 'Date')}: {new Date(selectedSupplyOrder.date).toLocaleString(uiLocale)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSupplyOrder && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {selectedSupplyOrder.driverName && (
                  <div>
                    <p className="text-sm text-muted-foreground">{tsu('history.driver', 'Chauffeur')}</p>
                    <p className="font-medium">{selectedSupplyOrder.driverName}</p>
                  </div>
                )}
                {selectedSupplyOrder.clientName && (
                  <div>
                    <p className="text-sm text-muted-foreground">{tsu('history.client', 'Client')}</p>
                    <p className="font-medium">{selectedSupplyOrder.clientName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">{tsu('history.totalAmount', 'Montant Total')}</p>
                  <p className="font-medium">{(Number(selectedSupplyOrder.total) || 0).toFixed(2)} DH</p>
                </div>
              </div>
              
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tsu('history.product', 'Produit')}</TableHead>
                      <TableHead>{tsu('history.emptyQty', 'Quantité Vides')}</TableHead>
                      <TableHead>{tsu('history.fullQty', 'Quantité Pleines')}</TableHead>
                      <TableHead>{tsu('history.unitPrice', 'Prix Unitaire')}</TableHead>
                      <TableHead className="text-right">{tsu('history.amount', 'Montant')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSupplyOrder.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.bottleTypeName}</TableCell>
                        <TableCell>{item.emptyQuantity}</TableCell>
                        <TableCell>{item.fullQuantity}</TableCell>
                        <TableCell>{(Number(item.unitPrice) || 0).toFixed(2)} DH</TableCell>
                        <TableCell className="text-right">{(Number(item.amount) || 0).toFixed(2)} DH</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => handlePrintBS(selectedSupplyOrder)}>
                  <Download className="w-4 h-4 mr-2" />
                  {tsu('history.downloadPdf', 'Télécharger PDF')}
                </Button>
                <Button onClick={() => setSupplyDetailsDialogOpen(false)}>
                  {tsu('history.close', 'Fermer')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Order Details Dialog */}
      <Dialog open={returnDetailsDialogOpen} onOpenChange={setReturnDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{tsu('dialogs.bdDetailsTitle', "Détails du Bon d'Entrée")}</DialogTitle>
            <DialogDescription>
              {tsu('dialogs.bdNumberPrefix', "Bon d'Entrée N°")} {selectedReturnOrder?.orderNumber ?? ''} - {selectedReturnOrder ? safeDate(selectedReturnOrder.date).toLocaleString(uiLocale) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedReturnOrder && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">{tr('Référence B.S', 'مرجع B.S')}</p>
                  <p className="font-medium">{selectedReturnOrder.supplyOrderNumber}</p>
                </div>
                {selectedReturnOrder.driverName && (
                  <div>
                    <p className="text-sm text-muted-foreground">{tr('Chauffeur', 'السائق')}</p>
                    <p className="font-medium">{selectedReturnOrder.driverName}</p>
                  </div>
                )}
                {selectedReturnOrder.clientName && (
                  <div>
                    <p className="text-sm text-muted-foreground">{tr('Client', 'الزبون')}</p>
                    <p className="font-medium">{selectedReturnOrder.clientName}</p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{tr('Produit', 'المنتج')}</TableHead>
                      <TableHead className="whitespace-nowrap">{tr('Vides', 'فارغة')}</TableHead>
                      <TableHead className="whitespace-nowrap">{tr('Pleines', 'ممتلئة')}</TableHead>
                      <TableHead className="whitespace-nowrap">{tr('Étrangères', 'أجنبية')}</TableHead>
                      <TableHead className="whitespace-nowrap">{tr('Défectueuses', 'معيبة')}</TableHead>
                      <TableHead className="whitespace-nowrap">{tr('Consigne', 'رهن')}</TableHead>
                      <TableHead className="whitespace-nowrap">R.C</TableHead>
                      <TableHead className="whitespace-nowrap">{tr('Ventes', 'مبيعات')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReturnOrder.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium whitespace-nowrap">{item.bottleTypeName}</TableCell>
                        <TableCell>{item.returnedEmptyQuantity}</TableCell>
                        <TableCell>{item.returnedFullQuantity}</TableCell>
                        <TableCell>{item.foreignQuantity}</TableCell>
                        <TableCell>{item.defectiveQuantity}</TableCell>
                        <TableCell>{item.consigneQuantity || 0}</TableCell>
                        <TableCell>{item.lostQuantity}</TableCell>
                        <TableCell>{(item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Payment Info Section if available in note */}
              {(() => {
                const paymentInfo = getReturnPaymentInfo(selectedReturnOrder);
                if (!paymentInfo) return null;
                return (
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {tsu('history.paymentDetails', 'Détails du Règlement')}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-2 bg-background rounded border">
                        <p className="text-xs text-muted-foreground">{tsu('history.cash', 'Espèces')}</p>
                        <p className="font-bold text-green-600">{(Number(paymentInfo.cash) || 0).toFixed(2)} DH</p>
                      </div>
                      <div className="p-2 bg-background rounded border">
                        <p className="text-xs text-muted-foreground">{tsu('history.cheque', 'Chèque')}</p>
                        <p className="font-bold text-blue-600">{(Number(paymentInfo.check) || 0).toFixed(2)} DH</p>
                      </div>
                      <div className="p-2 bg-background rounded border">
                        <p className="text-xs text-muted-foreground">{tsu('history.mygaz', 'MYGAZ')}</p>
                        <p className="font-bold text-blue-800">{(Number(paymentInfo.mygaz) || 0).toFixed(2)} DH</p>
                      </div>
                      <div className="p-2 bg-background rounded border">
                        <p className="text-xs text-muted-foreground">{tsu('history.remainingDebt', 'Dette Restante')}</p>
                        <p className="font-bold text-red-600">{(Number(paymentInfo.debt) || 0).toFixed(2)} DH</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="text-sm font-medium">{tsu('history.totalVoucherAmount', 'Montant Total du Bon:')}</span>
                      <span className="text-lg font-bold">{(Number(paymentInfo.total) || 0).toFixed(2)} DH</span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="font-semibold">{tsu('history.legend', 'Légende:')}</div><div></div>
                <div><span className="font-medium">{tsu('history.empty', 'Vides:')}</span> {tsu('history.emptyLegend', 'Bouteilles vides retournées')}</div>
                <div><span className="font-medium">{tsu('history.full', 'Pleines:')}</span> {tsu('history.fullLegend', 'Bouteilles pleines retournées')}</div>
                <div><span className="font-medium">{tsu('history.foreign', 'Étrangères:')}</span> {tsu('history.foreignLegend', "Bouteilles d'autres fournisseurs")}</div>
                <div><span className="font-medium">{tsu('history.defective', 'Défectueuses:')}</span> {tsu('history.defectiveLegend', 'Bouteilles endommagées')}</div>
                <div><span className="font-medium">{tsu('history.lost', 'Perdues:')}</span> {tsu('history.lostLegend', 'Bouteilles non retournées')}</div>
                <div><span className="font-medium">{tsu('history.sold', 'Vendues:')}</span> {tsu('history.soldLegend', 'Bouteilles vendues au client')}</div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setReturnDetailsDialogOpen(false)}>{tsu('history.close', 'Fermer')}</Button>
                <Button onClick={() => handlePrintBD(selectedReturnOrder)}>
                  <Download className="w-4 h-4 mr-2" />
                  {tsu('history.downloadPdf', 'Télécharger PDF')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
        setPaymentDialogOpen(open);
        if (!open) resetPaymentDialog();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {tsu('payment.title', 'Règlement - B.D')} {selectedReturnOrderForPayment?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              {tsu('payment.subtitle', "Enregistrer le paiement pour ce bon d'entrée")}
            </DialogDescription>
          </DialogHeader>

          {selectedReturnOrderForPayment && (
            <>
              {/* Order Information */}
              <div className="bg-muted/50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">{tsu('history.date', 'Date')}:</span> {new Date(selectedReturnOrderForPayment.date).toLocaleString(uiLocale)}
                  </div>
                  <div>
                    <span className="font-medium">{tsu('payment.bsReference', 'B.S Référence')}:</span> {selectedReturnOrderForPayment.supplyOrderNumber}
                  </div>
                  <div>
                    <span className="font-medium">{tsu('history.driver', 'Chauffeur')}:</span> {selectedReturnOrderForPayment.driverName || '-'}
                  </div>
                  <div>
                    <span className="font-medium">{tsu('history.client', 'Client')}:</span> {selectedReturnOrderForPayment.clientName || '-'}
                  </div>
                </div>
              </div>

              {/* Products Summary */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">{tsu('payment.returnedProducts', 'Produits retournés:')}</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tsu('history.product', 'Produit')}</TableHead>
                        <TableHead className="text-center">{tsu('payment.quantity', 'Quantité')}</TableHead>
                        <TableHead className="text-right">{tsu('history.unitPrice', 'Prix Unitaire')}</TableHead>
                        <TableHead className="text-right">{tsu('history.amount', 'Montant')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturnOrderForPayment.items.map((item: any, idx: number) => {
                        // Find the original supply order to get prices
                        const originalSupplyOrder = supplyOrders.find(order => 
                          order.id === selectedReturnOrderForPayment.supplyOrderId
                        );
                        const originalItem = originalSupplyOrder?.items.find((origItem: any) => 
                          origItem.bottleTypeId === item.bottleTypeId
                        );

                        // Calculate sold quantity based on returned empty + consigne
                        const soldQuantity = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);

                        const unitPrice = originalItem?.unitPrice || 0;
                        const amount = soldQuantity * unitPrice;

                        // Only show items that have been sold
                        if (soldQuantity === 0) return null;

                        return (
                          <TableRow key={idx}>
                            <TableCell>{item.bottleTypeName}</TableCell>
                            <TableCell className="text-center">{soldQuantity}</TableCell>
                            <TableCell className="text-right">{(Number(unitPrice) || 0).toFixed(2)} DH</TableCell>
                            <TableCell className="text-right font-medium">{(Number(amount) || 0).toFixed(2)} DH</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment Summary Section */}
              <Card className="border-2 border-primary/20 mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    {tr('Total des Montants et Méthodes de Paiement', 'إجمالي المبالغ وطرق الدفع')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Total Amount Display */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium">{tr('Total TTC net à payer', 'صافي إجمالي TTC الواجب دفعه')}:</span>
                        <span className="text-2xl font-bold text-primary">{(Number(calculateNetToPay()) || 0).toFixed(2)} DH</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {(() => {
                          let soldItemsCount = 0;
                          selectedReturnOrderForPayment.items.forEach((item: any) => {
                            const soldQuantity = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
                            if (soldQuantity > 0) soldItemsCount++;
                          });
                          return language === 'ar'
                            ? `المنتجات المباعة: ${soldItemsCount} عنصر`
                            : `Produits vendus: ${soldItemsCount} article${soldItemsCount > 1 ? 's' : ''}`;
                        })()}
                      </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="payment-cash-amount">{tr('Montant payé en Espèces', 'المبلغ المدفوع نقدًا')}</Label>
                        <Input
                          id="payment-cash-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          max={calculatePaymentTotals().total}
                          value={paymentCashAmount}
                          onChange={(e) => setPaymentCashAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-lg"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment-check-amount">{tr('Montant payé par Chèque', 'المبلغ المدفوع بالشيك')}</Label>
                        <Input
                          id="payment-check-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          max={calculatePaymentTotals().total}
                          value={paymentCheckAmount}
                          onChange={(e) => setPaymentCheckAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-lg"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment-mygaz-amount" className="text-blue-600 font-semibold">{tr('Montant MYGAZ', 'مبلغ MYGAZ')}</Label>
                        <Input
                          id="payment-mygaz-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={paymentMygazAmount}
                          onChange={(e) => setPaymentMygazAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-lg border-blue-200 focus:border-blue-400"
                        />
                      </div>
                    </div>

                    {/* Debt Calculation */}
                    {(paymentCashAmount || paymentCheckAmount || paymentMygazAmount) && (
                      <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-lg font-medium text-orange-800">{tr('Dette Chauffeur (Gaz)', 'دين السائق (غاز)')}:</span>
                          <span className="text-2xl font-bold text-orange-600">{(Number(calculatePaymentDebt()) || 0).toFixed(2)} DH</span>
                        </div>
                        <div className="text-sm text-orange-700">
                          {tr('Calcul', 'الحساب')}: ({(Number(calculatePaymentTotals().total) || 0).toFixed(2)}) - ({(parseFloat(paymentCashAmount) || 0).toFixed(2)} + {(parseFloat(paymentCheckAmount) || 0).toFixed(2)} + {(parseFloat(paymentMygazAmount) || 0).toFixed(2)}) = {(Number(calculatePaymentDebt()) || 0).toFixed(2)} DH
                        </div>
                        {calculatePaymentDebt() > 0 && selectedReturnOrderForPayment.driverId && (
                          <div className="mt-2 p-2 bg-orange-100 rounded text-sm text-orange-800">
                            ⚠️ {tr('Ce montant sera enregistré comme dette du chauffeur sélectionné', 'سيتم تسجيل هذا المبلغ كدين على السائق المحدد')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Summary */}
                    {(paymentCashAmount || paymentCheckAmount || paymentMygazAmount) && (
                      <div className="grid md:grid-cols-4 gap-4 pt-4 border-t">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-green-600">{tr('Espèces', 'نقدًا')}</div>
                          <div className="text-lg font-bold text-green-700">{(parseFloat(paymentCashAmount) || 0).toFixed(2)} DH</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-600">{tr('Chèque', 'شيك')}</div>
                          <div className="text-lg font-bold text-blue-700">{(parseFloat(paymentCheckAmount) || 0).toFixed(2)} DH</div>
                        </div>
                        <div className="text-center p-3 bg-blue-100 rounded-lg">
                          <div className="text-sm text-blue-800">MYGAZ</div>
                          <div className="text-lg font-bold text-blue-900">{(parseFloat(paymentMygazAmount) || 0).toFixed(2)} DH</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className="text-sm text-red-600">{tr('Dette (Gaz)', 'الدين (غاز)')}</div>
                          <div className="text-lg font-bold text-red-700">{(Number(calculatePaymentDebt()) || 0).toFixed(2)} DH</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Résumé et Paiement Section */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {tr('Résumé et Paiement', 'الملخص والدفع')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Totals Summary */}
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">{tr('Montant HT', 'المبلغ قبل الضريبة')}</p>
                        <p className="font-bold text-lg">{(Number(calculatePaymentTotals().subtotal) || 0).toFixed(2)} DH</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{tr('TVA (10%)', 'الضريبة (10%)')}</p>
                        <p className="font-bold text-lg">{(Number(calculatePaymentTotals().taxAmount) || 0).toFixed(2)} DH</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{tr('Total TTC', 'الإجمالي TTC')}</p>
                        <p className="font-bold text-xl text-primary">{(Number(calculatePaymentTotals().total) || 0).toFixed(2)} DH</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{tr('Montant en Espèces', 'المبلغ نقدًا')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentCashAmount}
                        onChange={(e) => setPaymentCashAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{tr('Montant par Chèque', 'المبلغ بالشيك')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentCheckAmount}
                        onChange={(e) => setPaymentCheckAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  {tr('Annuler', 'إلغاء')}
                </Button>
                <Button 
                  onClick={handlePaymentSubmit}
                  disabled={!paymentCashAmount && !paymentCheckAmount}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  {tr('Enregistrer le règlement', 'حفظ التسوية')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SupplyReturn;
