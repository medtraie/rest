import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { Users, DollarSign, TrendingUp, TrendingDown, Download, Eye, Edit, CheckCircle, UserX, Package, Search, Calendar, UserPlus, Filter, Sparkles, ShieldAlert, Activity, LayoutGrid, Table2, Zap, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { AddDriverDialog } from '@/components/dialogs/AddDriverDialog';
import { RecordPaymentDialog } from '@/components/dialogs/RecordPaymentDialog';
import { Driver as DriverType } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'framer-motion';
import { useT } from '@/contexts/LanguageContext';

const Drivers = () => {
  const { drivers, bottleTypes, transactions, cashOperations, deleteDriver, canDeleteDriver } = useApp();
  const t = useT();
  const td = (key: string, fallback: string) => t(`drivers.pdf.${key}`, fallback);
  const [selectedDriver, setSelectedDriver] = useState<DriverType | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [bottleManagementOpen, setBottleManagementOpen] = useState(false);
  const [isEditingRC, setIsEditingRC] = useState(false);
  const [editedBottles, setEditedBottles] = useState<Record<string, number>>({});
  const [lastEditDate, setLastEditDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<DriverType | null>(null);
  const [driversCanvas, setDriversCanvas] = useState<'creative' | 'focus'>('creative');
  const [driversLane, setDriversLane] = useState<'all' | 'attention' | 'credit' | 'balanced'>('all');
  const [driversView, setDriversView] = useState<'table' | 'cards'>('table');
  const [driversSort, setDriversSort] = useState<'priority' | 'balance'>('priority');
  const [commandQuery, setCommandQuery] = useState('');
  const [priorityMode, setPriorityMode] = useState<'all' | 'hot'>('all');

  const { updateDriver } = useApp();

  const today = new Date();

  // Filter transactions for the selected driver
  const driverTransactions = useMemo(() => {
    if (!selectedDriver) return [];
    return (transactions || [])
      .filter(tx => String(tx.driverId) === String(selectedDriver.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedDriver, transactions]);

  const findCashOperationForTx = (tx: any, driverOverride?: DriverType | null) => {
    const targetDriver = driverOverride ?? selectedDriver;
    if (!targetDriver) return null;
    const name = (targetDriver.name || '').toLowerCase();
    if (!name) return null;
    const txTime = new Date(tx?.date || 0).getTime();
    const matches = (cashOperations || []).filter(op => {
      const opName = (op?.name || '').toLowerCase();
      if (!opName.includes(name)) return false;
      const opTime = new Date(op?.date || 0).getTime();
      return Math.abs(opTime - txTime) <= 24 * 60 * 60 * 1000;
    });
    if (!matches.length) return null;
    return matches.reduce((best, op) => {
      const bestDiff = Math.abs(new Date(best.date).getTime() - txTime);
      const opDiff = Math.abs(new Date(op.date).getTime() - txTime);
      return opDiff < bestDiff ? op : best;
    }, matches[0]);
  };

  const getTransactionDescription = (tx: any) => {
    const direct = tx?.description ?? tx?.details ?? tx?.detail ?? tx?.note ?? tx?.notes ?? tx?.label ?? tx?.libelle ?? tx?.motif ?? tx?.comment ?? tx?.remarks ?? tx?.remark;
    const nestedSource = tx?.details ?? tx?.detail ?? tx?.meta ?? tx?.data;
    const nested = nestedSource && typeof nestedSource === 'object'
      ? (nestedSource as any).description ?? (nestedSource as any).details ?? (nestedSource as any).detail ?? (nestedSource as any).label ?? (nestedSource as any).libelle ?? (nestedSource as any).motif ?? (nestedSource as any).note ?? (nestedSource as any).comment
      : undefined;
    const value = direct ?? nested;
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const getTransactionAmount = (tx: any) => {
    const direct = tx?.amount ?? tx?.montant ?? tx?.value ?? tx?.totalValue ?? tx?.totalvalue ?? tx?.totalVentes ?? tx?.totalventes ?? tx?.total ?? tx?.debtChange ?? tx?.balanceChange ?? tx?.paidAmount ?? tx?.paymentAmount ?? tx?.somme ?? tx?.sum;
    const nestedSource = tx?.details ?? tx?.detail ?? tx?.meta ?? tx?.data;
    const nested = nestedSource && typeof nestedSource === 'object'
      ? (nestedSource as any).amount ?? (nestedSource as any).montant ?? (nestedSource as any).value ?? (nestedSource as any).totalValue ?? (nestedSource as any).total
      : undefined;
    const raw = direct ?? nested ?? 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.-]/g, '');
      const parsed = Number(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return Number(raw) || 0;
  };

  const getTransactionDisplay = (tx: any, driverOverride?: DriverType | null) => {
    const description = getTransactionDescription(tx);
    const amount = getTransactionAmount(tx);
    const targetDriver = driverOverride ?? selectedDriver;
    if ((description && amount !== 0) || !targetDriver) {
      return { description, amount };
    }
    if (tx?.type !== 'payment' && tx?.type !== 'credit') {
      return { description, amount };
    }
    const op = findCashOperationForTx(tx, targetDriver);
    if (!op) return { description, amount };
    return {
      description: description || op.name || '',
      amount: amount !== 0 ? amount : Number(op.amount || 0),
    };
  };

  const repaymentStats = useMemo(() => {
    if (!selectedDriver) {
      return { totalPaid: 0, totalDebt: 0, progress: 0 };
    }
    const paidTypes = new Set(['payment', 'credit']);
    const debtTypes = new Set(['debt', 'debit']);
    const totalPaid = driverTransactions
      .filter(tx => paidTypes.has(tx?.type))
      .reduce((sum, tx) => sum + Math.abs(getTransactionAmount(tx)), 0);
    const debtFromTransactions = driverTransactions
      .filter(tx => debtTypes.has(tx?.type))
      .reduce((sum, tx) => sum + Math.abs(getTransactionAmount(tx)), 0);
    const currentDebt = Math.abs(selectedDriver.debt ?? 0);
    const totalDebt = Math.max(debtFromTransactions, currentDebt + totalPaid);
    const progress = totalDebt > 0 ? Math.min((totalPaid / totalDebt) * 100, 100) : 0;
    return { totalPaid, totalDebt, progress };
  }, [driverTransactions, selectedDriver]);

  React.useEffect(() => {
    if (selectedDriver && bottleManagementOpen) {
      setEditedBottles(selectedDriver.remainingBottles || {});
      setLastEditDate(selectedDriver.lastRCUpdate || null);
    }
  }, [selectedDriver, bottleManagementOpen]);
  React.useEffect(() => {
    const handleDriversShortcuts = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === '1') {
        event.preventDefault();
        setDriversLane('all');
        document.getElementById('drivers-command-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (key === '2') {
        event.preventDefault();
        setDriversLane('attention');
        document.getElementById('drivers-command-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (key === '3') {
        event.preventDefault();
        setDriversLane('credit');
        document.getElementById('drivers-command-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (key === '4') {
        event.preventDefault();
        setDriversLane('balanced');
        document.getElementById('drivers-command-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (key === 'k') {
        event.preventDefault();
        document.getElementById('drivers-command-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleDriversShortcuts);
    return () => window.removeEventListener('keydown', handleDriversShortcuts);
  }, []);

  const handleSaveRC = () => {
    if (selectedDriver) {
      const now = new Date().toISOString();
      updateDriver(selectedDriver.id, {
        remainingBottles: { ...editedBottles, _isOverride: true } as any,
        lastRCUpdate: now
      });
      setLastEditDate(now);
      setIsEditingRC(false);
    }
  };

  const handleGenerateRCPDF = (driver: DriverType) => {
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy HH:mm', { locale: fr });

    // Header with Branding
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(t('brand', 'SFT GAZ'), 20, 28);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(td('systemTitle', 'SYSTÈME DE GESTION DE GAZ'), 20, 35);
    
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 70, 38);

    doc.setFontSize(10);
    doc.text(td('rcReportTitle', 'Rapport R.C - État du Stock'), 140, 25);
    doc.text(`${td('date', 'Date')}: ${dateStr}`, 140, 32);

    // Driver Information Section
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(td('driverInfo', 'INFORMATIONS DU CHAUFFEUR'), 20, 60);
    
    doc.setDrawColor(79, 70, 229); // indigo-600
    doc.setLineWidth(1);
    doc.line(20, 63, 40, 63);

    // Info Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(20, 68, 170, 25, 2, 2, 'F');
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${t('drivers.table.driverName', 'Nom du Chauffeur')}:`, 25, 78);
    doc.text(`${td('lastUpdate', 'Dernière mise à jour')}:`, 25, 85);
    
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(driver.name.toUpperCase(), 65, 78);
    
    const lastEdit = lastEditDate || driver.lastRCUpdate;
    doc.text(lastEdit ? format(new Date(lastEdit), 'dd/MM/yyyy HH:mm', { locale: fr }) : td('noChange', 'Aucune modification'), 65, 85);

    // Current RC Stock Table
    const tableStartY = 105;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(td('currentRcState', 'ÉTAT ACTUEL DU STOCK R.C'), 20, tableStartY - 5);

    const excludedTypes = ['BNG 12KG', 'Propane 34KG', 'Détendeur Clic-On'];
    const stockData = bottleTypes
      .filter(type => !excludedTypes.includes(type.name))
      .map(type => {
        const qty = driver.remainingBottles?.[type.id] || 0;
        return [type.name, qty.toString()];
      })
      .filter(row => parseInt(row[1]) > 0);

    const totalRC = stockData.reduce((sum, row) => sum + parseInt(row[1]), 0);

    autoTable(doc, {
      startY: tableStartY,
      head: [[t('drivers.table.bottleType', 'Type de Bouteille').toUpperCase(), td('qtyInPossession', 'QUANTITÉ EN POSSESSION')]],
      body: stockData,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229], 
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: { 
        fontSize: 10,
        textColor: [51, 65, 85],
        cellPadding: 5
      },
      columnStyles: {
        1: { halign: 'center', fontStyle: 'bold' }
      },
      foot: [[td('totalRcBottles', 'TOTAL DES BOUTEILLES R.C'), totalRC.toString()]],
      footStyles: { 
        fillColor: [241, 245, 249], 
        textColor: [79, 70, 229], 
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'left'
      },
    });

    // History Table
    const historyRows: any[][] = [];
    (driver.rcHistory || [])
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(entry => {
        entry.changes.forEach(change => {
          const typeName =
            change.bottleTypeName ||
            bottleTypes.find(bt => String(bt.id) === String(change.bottleTypeId))?.name ||
            change.bottleTypeId;
          const diffStr = change.diff >= 0 ? `+${change.diff}` : `${change.diff}`;
          historyRows.push([
            format(new Date(entry.date), 'dd/MM/yyyy HH:mm'),
            typeName,
            change.previousQty,
            change.newQty,
            diffStr
          ]);
        });
      });

    if (historyRows.length > 0) {
      const historyStartY = (doc as any).lastAutoTable.finalY + 15;
      
      // Check for page break
      if (historyStartY > 240) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(td('rcHistoryTitle', 'HISTORIQUE DES MODIFICATIONS R.C'), 20, 20);
        autoTable(doc, {
          startY: 25,
          head: [[td('dateUpper', 'DATE'), td('typeUpper', 'TYPE'), td('before', 'AVANT'), td('after', 'APRÈS'), td('diff', 'DIFF')]],
          body: historyRows,
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
              const diff = parseInt(data.cell.raw as string);
              if (diff > 0) data.cell.styles.textColor = [22, 163, 74];
              else if (diff < 0) data.cell.styles.textColor = [220, 38, 38];
            }
          }
        });
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(td('rcHistoryTitle', 'HISTORIQUE DES MODIFICATIONS R.C'), 20, historyStartY - 5);
        
        autoTable(doc, {
          startY: historyStartY,
          head: [[td('dateUpper', 'DATE'), td('typeUpper', 'TYPE'), td('before', 'AVANT'), td('after', 'APRÈS'), td('diff', 'DIFF')]],
          body: historyRows,
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
              const diff = parseInt(data.cell.raw as string);
              if (diff > 0) data.cell.styles.textColor = [22, 163, 74];
              else if (diff < 0) data.cell.styles.textColor = [220, 38, 38];
            }
          }
        });
      }
    }

    // Signature Section
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    if (finalY < 250) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(td('driverSignature', 'Signature Chauffeur'), 40, finalY + 25);
      doc.text(td('managerSignature', 'Signature Responsable'), 130, finalY + 25);
      
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.line(30, finalY + 45, 80, finalY + 45);
      doc.line(120, finalY + 45, 170, finalY + 45);
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${td('autoGeneratedBy', 'Document généré automatiquement par CAMION Gestion v1.0')} - ${td('page', 'Page')} ${i} ${td('of', 'sur')} ${pageCount}`,
        105,
        288,
        { align: 'center' }
      );
    }

    doc.save(`RC_${driver.name.replace(/\s+/g, '_')}_${format(now, 'yyyyMMdd')}.pdf`);
  };

  const totalDebt = drivers.reduce((sum, d) => sum + Math.abs(d.debt || 0), 0);
  const totalAdvances = drivers.reduce((sum, d) => sum + (d.advances || 0), 0);
  const driversInDebt = drivers.filter(d => (d.balance || 0) < 0).length;
  const isDriverClosed = (driver: DriverType) => Number(driver.debtThreshold || 0) > 0 && Number(driver.debt || 0) >= Number(driver.debtThreshold || 0);

  const filteredDrivers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return drivers.filter((d) => {
      const nameMatch = !term || (d.name || '').toLowerCase().includes(term);
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'closed' && isDriverClosed(d)) ||
        (statusFilter === 'debt' && (d.balance || 0) < 0) ||
        (statusFilter === 'credit' && (d.balance || 0) > 0) ||
        (statusFilter === 'balanced' && (d.balance || 0) === 0);
      return nameMatch && statusMatch;
    });
  }, [drivers, searchTerm, statusFilter]);
  const driverInsights = useMemo(() => {
    const now = Date.now();
    return filteredDrivers.map((driver) => {
      const totalRC = Object.values(driver.remainingBottles || {}).reduce((sum, qty) => sum + qty, 0);
      const lastTx = (transactions || [])
        .filter((tx) => String(tx.driverId) === String(driver.id))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const lastTxMs = lastTx ? new Date(lastTx.date).getTime() : NaN;
      const idleDays = Number.isNaN(lastTxMs) ? 30 : Math.max(0, Math.floor((now - lastTxMs) / (1000 * 60 * 60 * 24)));
      const riskScore =
        (driver.balance < 0 ? Math.abs(driver.balance) : 0) * 1.5 +
        (totalRC === 0 ? 80 : 0) +
        (idleDays >= 7 ? idleDays * 2 : 0) +
        Math.abs(driver.debt || 0) * 0.4;
      return {
        driver,
        totalRC,
        idleDays,
        riskScore,
      };
    });
  }, [filteredDrivers, transactions]);
  const laneDrivers = useMemo(() => {
    const laneFiltered = driverInsights.filter(({ driver }) => {
      if (driversLane === 'all') return true;
      if (driversLane === 'attention') return (driver.balance || 0) < 0;
      if (driversLane === 'credit') return (driver.balance || 0) > 0;
      return (driver.balance || 0) === 0;
    });
    return laneFiltered.sort((a, b) => {
      if (driversSort === 'priority') return b.riskScore - a.riskScore;
      return Math.abs(b.driver.balance || 0) - Math.abs(a.driver.balance || 0);
    });
  }, [driverInsights, driversLane, driversSort]);
  const commandCenterDrivers = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    return laneDrivers.filter(({ driver, riskScore }) => {
      const matchesQuery = query.length === 0 || driver.name.toLowerCase().includes(query);
      const matchesPriority = priorityMode === 'all' || riskScore >= 120;
      return matchesQuery && matchesPriority;
    });
  }, [laneDrivers, commandQuery, priorityMode]);
  const attentionDrivers = driverInsights
    .filter((item) => (item.driver.balance || 0) < 0 || item.totalRC === 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
  const displayedDrivers = commandCenterDrivers.map((item) => item.driver);
  const attentionCount = driverInsights.filter((item) => item.riskScore >= 120).length;
  const healthyCount = driverInsights.filter((item) => item.riskScore < 120).length;
  const driverTimeline = useMemo(() => {
    return (transactions || [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map((tx) => {
        const driver = drivers.find((d) => String(d.id) === String(tx.driverId));
        const amount = getTransactionAmount(tx);
        const kind = tx.type === 'debt' || tx.type === 'debit' ? t('drivers.status.debt', 'Dette') : t('drivers.status.payment', 'Paiement');
        return {
          id: tx.id,
          date: tx.date,
          driverName: driver?.name || t('drivers.common.driver', 'Driver'),
          amount,
          kind
        };
      });
  }, [transactions, drivers, t]);

  const handleGeneratePDF = (driver: DriverType) => {
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy HH:mm', { locale: fr });

    // Header with Branding
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(t('brand', 'SFT GAZ'), 20, 28);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(td('systemTitle', 'SYSTÈME DE GESTION DE GAZ'), 20, 35);
    
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 70, 38);

    doc.setFontSize(10);
    doc.text(td('financialReportTitle', 'Rapport Financier Chauffeur'), 140, 25);
    doc.text(`${td('date', 'Date')}: ${dateStr}`, 140, 32);

    // Driver Information Section
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(td('driverInfo', 'INFORMATIONS DU CHAUFFEUR'), 20, 60);
    
    doc.setDrawColor(79, 70, 229); // indigo-600
    doc.setLineWidth(1);
    doc.line(20, 63, 40, 63);

    // Info Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(20, 68, 170, 25, 2, 2, 'F');
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${t('drivers.table.driverName', 'Nom du Chauffeur')}:`, 25, 78);
    doc.text(`${td('currentStatus', 'Statut Actuel')}:`, 25, 85);
    
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(driver.name.toUpperCase(), 65, 78);
    
    const statusText = driver.balance === 0 ? td('balancedUpper', 'ÉQUILIBRÉ') : driver.balance > 0 ? td('creditUpper', 'EN CRÉDIT') : td('debtUpper', 'EN DETTE');
    doc.text(statusText, 65, 85);

    // Financial Summary Section Title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(td('financialSummary', 'RÉSUMÉ FINANCIER'), 20, 105);

    // Helper to format numbers without thousands separator
    const formatAmount = (amount: number) => Math.abs(amount).toFixed(0);

    // Financial Summary Boxes
    const boxWidth = 55;
    const startX = 20;
    const boxY = 110;

    // Dette Box
    doc.setFillColor(254, 242, 242); // red-50
    doc.setDrawColor(252, 165, 165); // red-300
    doc.setLineWidth(0.5);
    doc.roundedRect(startX, boxY, boxWidth, 30, 2, 2, 'FD');
    doc.setTextColor(153, 27, 27); // red-800
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(td('totalDebtUpper', 'TOTAL DETTE'), startX + 5, boxY + 10);
    doc.setFontSize(16);
    doc.text(`${formatAmount(driver.debt || 0)} DH`, startX + 5, boxY + 22);

    // Avances Box
    doc.setFillColor(240, 253, 244); // green-50
    doc.setDrawColor(134, 239, 172); // green-300
    doc.roundedRect(startX + boxWidth + 2.5, boxY, boxWidth, 30, 2, 2, 'FD');
    doc.setTextColor(22, 101, 52); // green-800
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(td('totalAdvancesUpper', 'TOTAL AVANCES'), startX + boxWidth + 7.5, boxY + 10);
    doc.setFontSize(16);
    doc.text(`${formatAmount(driver.advances || 0)} DH`, startX + boxWidth + 7.5, boxY + 22);

    // Balance Box
    const balanceColor = driver.balance >= 0 ? [240, 253, 244] : [254, 242, 242];
    const balanceBorder = driver.balance >= 0 ? [134, 239, 172] : [252, 165, 165];
    const balanceText = driver.balance >= 0 ? [21, 128, 61] : [185, 28, 28];

    doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.setDrawColor(balanceBorder[0], balanceBorder[1], balanceBorder[2]);
    doc.roundedRect(startX + (boxWidth + 2.5) * 2, boxY, boxWidth + 2.5, 30, 2, 2, 'FD');
    doc.setTextColor(balanceText[0], balanceText[1], balanceText[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(td('finalBalanceUpper', 'SOLDE FINAL'), startX + (boxWidth + 2.5) * 2 + 5, boxY + 10);
    doc.setFontSize(16);
    doc.text(`${formatAmount(driver.balance || 0)} DH`, startX + (boxWidth + 2.5) * 2 + 5, boxY + 22);

    // Transactions Table
    const tableStartY = 155;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(td('recentTransactionsHistory', 'HISTORIQUE DES RÉCENTES TRANSACTIONS'), 20, tableStartY - 5);

    const txList = (transactions || [])
      .filter(tx => String(tx.driverId) === String(driver.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);

    const tableData = txList.map(tx => {
      const display = getTransactionDisplay(tx, driver);
      return [
        format(new Date(tx.date), 'dd/MM/yyyy HH:mm'),
        (tx.type === 'debit' || tx.type === 'debt') ? td('debtUpper', 'DETTE') : td('paymentUpper', 'PAIEMENT'),
        `${formatAmount(display.amount)} DH`,
        display.description || '-'
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [[td('dateUpper', 'DATE'), td('typeUpper', 'TYPE'), td('amountUpper', 'MONTANT'), td('descriptionUpper', 'DESCRIPTION')]],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: { 
        fontSize: 9,
        textColor: [51, 65, 85],
        cellPadding: 4
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 35, fontStyle: 'bold', halign: 'right' },
        3: { cellWidth: 'auto' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const type = data.cell.raw as string;
          if (type === td('debtUpper', 'DETTE')) {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (type === td('paymentUpper', 'PAIEMENT')) {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      }
    });

    // Signature Section
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    if (finalY < 240) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(td('driverSignature', 'Signature Chauffeur'), 40, finalY + 30);
      doc.text(td('managerSignature', 'Signature Responsable'), 130, finalY + 30);
      
      doc.setDrawColor(203, 213, 225);
      doc.line(30, finalY + 50, 80, finalY + 50);
      doc.line(120, finalY + 50, 170, finalY + 50);
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${td('autoGeneratedBy', 'Document généré automatiquement par CAMION Gestion v1.0')} - ${td('page', 'Page')} ${i} ${td('of', 'sur')} ${pageCount}`,
        105,
        288,
        { align: 'center' }
      );
    }

    doc.save(`Rapport_${driver.name.replace(/\s+/g, '_')}_${format(now, 'yyyyMMdd')}.pdf`);
  };
  const getBalanceStatus = (balance: number) => {
    if (balance > 0) return { variant: 'default' as const, icon: TrendingUp, text: t('drivers.status.credit', 'Crédit') };
    if (balance < 0) return { variant: 'destructive' as const, icon: TrendingDown, text: t('drivers.status.debt', 'Dette') };
    return { variant: 'secondary' as const, icon: DollarSign, text: t('drivers.status.balanced', 'Équilibré') };
  };

  return (
    <div className="app-page-shell p-8 space-y-8 bg-slate-50/30 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="app-dark-hero overflow-hidden border-0 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white shadow-2xl">
          <CardContent className="p-0">
            <div className="px-6 py-6 md:px-8 md:py-7 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="space-y-2">
                  <Badge className="bg-white/15 border-white/20 text-white hover:bg-white/20">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    {t('drivers.hero.studio', 'Drivers Studio')}
                  </Badge>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium capitalize">{format(today, 'eeee d MMMM yyyy', { locale: fr })}</span>
                  </div>
                  <h1 className="app-page-title text-3xl md:text-4xl font-black tracking-tight">{t('drivers.hero.title', 'Gestion des Chauffeurs')}</h1>
                  <p className="app-page-subtitle text-slate-200/90">{t('drivers.hero.subtitle', 'Pilotage créatif des soldes, paiements et stocks R.C sans changer la logique métier.')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[280px]">
                  <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-wider text-slate-200">{t('drivers.hero.attention', 'Attention')}</div>
                    <div className="text-2xl font-black">{attentionCount}</div>
                  </div>
                  <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-wider text-slate-200">{t('drivers.hero.stable', 'Stable')}</div>
                    <div className="text-2xl font-black">{healthyCount}</div>
                  </div>
                  <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-wider text-slate-200">{t('drivers.hero.drivers', 'Drivers')}</div>
                    <div className="text-2xl font-black">{drivers.length}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setDriversCanvas((prev) => prev === 'creative' ? 'focus' : 'creative')} className="bg-white text-slate-900 hover:bg-slate-100">
                  {driversCanvas === 'creative' ? t('drivers.hero.modeFocus', 'Mode Focus') : t('drivers.hero.modeCreative', 'Mode Créatif')}
                </Button>
                <Button variant="secondary" size="sm" className="bg-white/10 text-white border border-white/20 hover:bg-white/15" onClick={() => alert(t('drivers.actions.generatingGlobal', 'Génération du rapport global...'))}>
                  <Download className="w-4 h-4 mr-2" />
                  {t('drivers.actions.globalReport', 'Rapport Global')}
                </Button>
                <AddDriverDialog trigger={
                  <Button size="sm" className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-md transition-all duration-200">
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('drivers.actions.addDriver', 'Ajouter un Chauffeur')}
                  </Button>
                } />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('drivers.stats.totalDrivers', 'Total Chauffeurs')}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-slate-900">{drivers.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-red-50/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingDown className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('drivers.stats.totalDebt', 'Dettes Totales')}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-red-600">
                    {Number(totalDebt || 0).toLocaleString()}
                  </p>
                  <span className="text-sm font-semibold text-red-400">DH</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('drivers.stats.totalAdvances', 'Avances Totales')}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-emerald-600">
                    {Number(totalAdvances || 0).toLocaleString()}
                  </p>
                  <span className="text-sm font-semibold text-emerald-400">DH</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-amber-50/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('drivers.stats.inDebt', 'En Dette')}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-amber-600">
                    {driversInDebt}
                  </p>
                  <span className="text-sm font-medium text-amber-400">{t('drivers.common.drivers', 'Chauffeurs')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card id="drivers-command-center" className="border-none shadow-xl shadow-slate-200/40 bg-white/95 rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <Activity className="w-5 h-5" />
                {t('drivers.commandCenter.title', 'Drivers Command Center')}
              </CardTitle>
              <p className="text-slate-200 text-sm">{t('drivers.commandCenter.subtitle', 'Focus sur les profils à risque et accélération des actions quotidiennes.')}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 min-w-[290px]">
              <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-200">{t('drivers.commandCenter.visible', 'Visibles')}</div>
                <div className="text-lg font-black">{commandCenterDrivers.length}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-200">{t('drivers.commandCenter.alerts', 'Alertes')}</div>
                <div className="text-lg font-black">{attentionDrivers.length}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-200">{t('drivers.status.debt', 'Dette')}</div>
                <div className="text-lg font-black">{driversInDebt}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-200">{t('drivers.status.credit', 'Crédit')}</div>
                <div className="text-lg font-black">{Math.max(0, drivers.length - driversInDebt)}</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={driversLane === 'all' ? 'default' : 'outline'} onClick={() => setDriversLane('all')}>{t('drivers.filters.all', 'Tout')}</Button>
            <Button size="sm" variant={driversLane === 'attention' ? 'default' : 'outline'} onClick={() => setDriversLane('attention')}>
              <ShieldAlert className="w-4 h-4 mr-1.5" />
              {t('drivers.hero.attention', 'Attention')}
            </Button>
            <Button size="sm" variant={driversLane === 'credit' ? 'default' : 'outline'} onClick={() => setDriversLane('credit')}>{t('drivers.status.credit', 'Crédit')}</Button>
            <Button size="sm" variant={driversLane === 'balanced' ? 'default' : 'outline'} onClick={() => setDriversLane('balanced')}>{t('drivers.status.balanced', 'Équilibré')}</Button>
            <Button size="sm" variant={driversSort === 'priority' ? 'secondary' : 'ghost'} onClick={() => setDriversSort('priority')} className="ml-auto">
              <Zap className="w-4 h-4 mr-1.5" />
              {t('drivers.filters.priority', 'Priorité')}
            </Button>
            <Button size="sm" variant={driversSort === 'balance' ? 'secondary' : 'ghost'} onClick={() => setDriversSort('balance')}>
              {t('drivers.common.balance', 'Balance')}
            </Button>
          </div>
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="drivers-command-search"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder={t('drivers.filters.quickSearch', 'Recherche rapide dans la lane active...')}
                className="pl-9 h-10 rounded-xl border-slate-200 bg-slate-50"
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <Button size="sm" variant={priorityMode === 'all' ? 'secondary' : 'ghost'} onClick={() => setPriorityMode('all')} className={priorityMode === 'all' ? 'bg-white shadow-sm' : ''}>
                {t('drivers.filters.all', 'Tous')}
              </Button>
              <Button size="sm" variant={priorityMode === 'hot' ? 'secondary' : 'ghost'} onClick={() => setPriorityMode('hot')} className={priorityMode === 'hot' ? 'bg-white shadow-sm text-amber-700' : ''}>
                {t('drivers.filters.hot', 'Hot')}
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setCommandQuery('')}>
                {t('drivers.actions.reset', 'Reset')}
              </Button>
            </div>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {attentionDrivers.map(({ driver, totalRC, idleDays, riskScore }) => (
              <div key={driver.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900 truncate">{driver.name}</div>
                  <Badge variant="outline" className="border-amber-300 text-amber-700">P{Math.round(riskScore)}</Badge>
                </div>
                <div className="text-xs text-slate-600 mt-1">{t('drivers.common.balance', 'Balance')}: {Number(driver.balance || 0).toLocaleString()} DH</div>
                <div className="text-xs text-slate-600">{t('drivers.common.stockRc', 'Stock RC')}: {totalRC} · {t('drivers.common.inactive', 'Inactif')}: {idleDays}j</div>
                <Button size="sm" variant="outline" className="h-7 mt-2 w-full text-xs" onClick={() => { setSelectedDriver(driver); setDetailsDialogOpen(true); }}>
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
                  {t('drivers.actions.openProfile', 'Ouvrir profil')}
                </Button>
              </div>
            ))}
            {attentionDrivers.length === 0 && (
              <div className="md:col-span-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-700 font-medium">
                {t('drivers.empty.noCriticalProfile', 'Aucun profil critique dans la vue actuelle.')}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('drivers.timeline.title', 'Timeline Drivers')}</div>
              <Badge variant="outline" className="text-slate-600 border-slate-300">{driverTimeline.length}</Badge>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {driverTimeline.map((item) => (
                <div key={item.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{item.driverName}</div>
                    <div className="text-xs text-slate-500">{format(new Date(item.date), 'dd/MM HH:mm')} · {item.kind}</div>
                  </div>
                  <div className={item.kind === 'Dette' ? 'text-sm font-bold text-rose-700' : 'text-sm font-bold text-emerald-700'}>
                    {Number(item.amount || 0).toLocaleString()} DH
                  </div>
                </div>
              ))}
              {driverTimeline.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">
                  {t('drivers.empty.noRecentActivity', 'Aucune activité récente disponible.')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main List Section */}
      <Card className={driversCanvas === 'creative' ? 'border-none shadow-md overflow-hidden bg-white' : 'border border-slate-200/70 shadow-sm overflow-hidden bg-white'}>
        <CardHeader className="border-b border-slate-100 bg-white/50 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-bold text-slate-800">{t('drivers.list.title', 'Liste des Chauffeurs')}</CardTitle>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  placeholder={t('drivers.list.searchPlaceholder', 'Rechercher un chauffeur...')}
                  className="pl-10 w-full md:w-[280px] bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Filter className="w-4 h-4 text-slate-500" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500">
                    <SelectValue placeholder={t('drivers.list.status', 'Statut')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('drivers.list.allStatuses', 'Tous les statuts')}</SelectItem>
                    <SelectItem value="closed" className="text-rose-700">Clôture</SelectItem>
                    <SelectItem value="debt" className="text-red-600">{t('drivers.list.inDebt', 'En dette')}</SelectItem>
                    <SelectItem value="credit" className="text-emerald-600">{t('drivers.list.inCredit', 'En crédit')}</SelectItem>
                    <SelectItem value="balanced" className="text-slate-600">{t('drivers.status.balanced', 'Équilibré')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <Button size="sm" variant={driversView === 'table' ? 'secondary' : 'ghost'} className={driversView === 'table' ? 'bg-white shadow-sm' : ''} onClick={() => setDriversView('table')}>
                  <Table2 className="w-4 h-4 mr-1.5" />
                  {t('drivers.list.table', 'Table')}
                </Button>
                <Button size="sm" variant={driversView === 'cards' ? 'secondary' : 'ghost'} className={driversView === 'cards' ? 'bg-white shadow-sm' : ''} onClick={() => setDriversView('cards')}>
                  <LayoutGrid className="w-4 h-4 mr-1.5" />
                  {t('drivers.list.cards', 'Cards')}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {driversView === 'table' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="py-4 pl-6 font-semibold text-slate-700">{t('drivers.table.driverName', 'Nom du Chauffeur')}</TableHead>
                    <TableHead className="py-4 font-semibold text-slate-700">Code</TableHead>
                    <TableHead className="py-4 font-semibold text-slate-700">Aide livreurs</TableHead>
                    <TableHead className="py-4 font-semibold text-slate-700">{t('drivers.status.debt', 'Dette')}</TableHead>
                    <TableHead className="py-4 font-semibold text-slate-700">{t('drivers.table.advances', 'Avances')}</TableHead>
                    <TableHead className="py-4 font-semibold text-slate-700">{t('drivers.common.balance', 'Balance')}</TableHead>
                    <TableHead className="py-4 font-semibold text-slate-700">{t('drivers.common.stockRc', 'Stock R.C')}</TableHead>
                    <TableHead className="py-4 font-semibold text-slate-700">{t('drivers.table.state', 'État')}</TableHead>
                    <TableHead className="py-4 pr-6 text-right font-semibold text-slate-700">{t('drivers.table.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedDrivers.length > 0 ? displayedDrivers.map((driver) => {
                    const balanceStatus = isDriverClosed(driver)
                      ? { variant: 'destructive' as const, icon: AlertTriangle, text: 'Clôture' }
                      : getBalanceStatus(driver.balance);
                    const totalRC = Object.values(driver.remainingBottles || {}).reduce((a, b) => a + b, 0);
                    return (
                      <TableRow key={driver.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0">
                        <TableCell className="py-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm">
                              {driver.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900">{driver.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-slate-700 font-medium">{driver.code || '-'}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-slate-700 font-medium">{driver.aideLivreurs || '-'}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-red-600 font-bold">
                            {Math.abs(driver.debt).toLocaleString()} <span className="text-[10px] opacity-70">DH</span>
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-emerald-600 font-bold">
                            {Number(driver.advances || 0).toLocaleString()} <span className="text-[10px] opacity-70">DH</span>
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            driver.balance > 0 ? 'bg-emerald-100 text-emerald-700' :
                            driver.balance < 0 ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {Math.abs(driver.balance).toLocaleString()} DH
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <Badge variant="outline" className={`font-bold px-3 py-1 ${totalRC > 0 ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            {totalRC}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={balanceStatus.variant} className="flex items-center gap-1.5 px-3 py-1 w-fit shadow-sm">
                            <balanceStatus.icon className="w-3.5 h-3.5" />
                            <span className="font-medium">{balanceStatus.text}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-right">
                          <div className="flex justify-end items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title={t('drivers.table.details', 'Détails')}
                            onClick={() => {
                              setSelectedDriver(driver);
                              setDetailsDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title={t('drivers.table.downloadPdf', 'Télécharger PDF')}
                            onClick={() => handleGeneratePDF(driver)}
                          >
                            <Download className="w-4.5 h-4.5" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            title={t('drivers.table.recordPayment', 'Enregistrer un Paiement')}
                            onClick={() => {
                              setSelectedDriver(driver);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <DollarSign className="w-4.5 h-4.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                            title={t('drivers.table.rcManagement', 'Gestion Bouteilles (R.C)')}
                            onClick={() => {
                              setSelectedDriver(driver);
                              setBottleManagementOpen(true);
                            }}
                          >
                            <Package className="w-4.5 h-4.5" />
                          </Button>
                          
                          {(() => {
                            const check = canDeleteDriver(driver.id);
                            return (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title={check.allowed ? t('drivers.table.deleteDriver', 'Supprimer le Chauffeur') : `${t('drivers.table.deleteUnavailable', 'Suppression indisponible')}: ${check.reason}`}
                            disabled={!check.allowed}
                            onClick={() => {
                              const rule = canDeleteDriver(driver.id);
                              if (!rule.allowed) {
                                toast(`${t('drivers.table.deleteImpossible', 'Impossible de supprimer')}: ${rule.reason}`);
                                return;
                              }
                              setDriverToDelete(driver);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <UserX className="w-4.5 h-4.5" />
                          </Button>
                            );
                          })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-20">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                            <Users className="w-8 h-8 text-slate-300" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900">{t('drivers.empty.noDriver', 'Aucun chauffeur trouvé')}</h3>
                          <p className="text-slate-500 max-w-[250px] mx-auto mt-1">
                            {searchTerm ? `${t('drivers.empty.noResultFor', 'Aucun résultat pour')} "${searchTerm}"` : t('drivers.empty.startByAdding', 'Commencez par ajouter un nouveau chauffeur à votre liste.')}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-5 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayedDrivers.map((driver) => {
                const totalRC = Object.values(driver.remainingBottles || {}).reduce((a, b) => a + b, 0);
                const balanceStatus = isDriverClosed(driver)
                  ? { variant: 'destructive' as const, icon: AlertTriangle, text: 'Clôture' }
                  : getBalanceStatus(driver.balance);
                return (
                  <div key={driver.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm">
                          {driver.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{driver.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Code: <span className="font-medium text-slate-700">{driver.code || '-'}</span> · Aide: <span className="font-medium text-slate-700">{driver.aideLivreurs || '-'}</span>
                          </div>
                          <Badge variant={balanceStatus.variant} className="mt-1">{balanceStatus.text}</Badge>
                        </div>
                      </div>
                      <Badge variant="outline" className={totalRC > 0 ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-50 text-slate-400 border-slate-100'}>
                        RC {totalRC}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-red-50 p-2">
                        <div className="text-red-500">{t('drivers.status.debt', 'Dette')}</div>
                        <div className="font-bold text-red-700">{Math.abs(driver.debt).toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <div className="text-emerald-600">{t('drivers.table.advances', 'Avances')}</div>
                        <div className="font-bold text-emerald-700">{Number(driver.advances || 0).toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <div className="text-slate-500">{t('drivers.common.balance', 'Balance')}</div>
                        <div className="font-bold text-slate-800">{Number(driver.balance || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedDriver(driver); setDetailsDialogOpen(true); }}><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleGeneratePDF(driver)}><Download className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedDriver(driver); setPaymentDialogOpen(true); }}><DollarSign className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedDriver(driver); setBottleManagementOpen(true); }}><Package className="w-4 h-4" /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        disabled={!canDeleteDriver(driver.id).allowed}
                        onClick={() => {
                          const rule = canDeleteDriver(driver.id);
                          if (!rule.allowed) {
                            toast(`${t('drivers.table.deleteImpossible', 'Impossible de supprimer')}: ${rule.reason}`);
                            return;
                          }
                          setDriverToDelete(driver);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {displayedDrivers.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                  {t('drivers.empty.noDriverInView', 'Aucun chauffeur trouvé dans cette vue.')}
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t border-slate-100">
            <div className="text-sm text-slate-500 font-medium">
              {t('drivers.pagination.showing', 'Affichage de')} <span className="text-slate-900 font-bold">{displayedDrivers.length}</span> {t('drivers.pagination.of', 'sur')} <span className="text-slate-900 font-bold">{drivers.length}</span> {t('drivers.common.drivers', 'chauffeurs')}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-600" disabled={true}>
                {t('drivers.pagination.previous', 'Précédent')}
              </Button>
              <div className="flex items-center gap-1">
                <Button size="sm" className="w-8 h-8 p-0 bg-indigo-600 hover:bg-indigo-700">1</Button>
              </div>
              <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-600" disabled={true}>
                {t('drivers.pagination.next', 'Suivant')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      {selectedDriver && (
        <RecordPaymentDialog
          driver={selectedDriver}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
        />
      )}

      {/* Details Dialog */}
      {selectedDriver && (
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
            <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-10">
                <Users className="w-48 h-48" />
              </div>
              <DialogHeader className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">
                    {selectedDriver.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-3xl font-bold text-white">{selectedDriver.name}</DialogTitle>
                    <p className="text-indigo-100 mt-1 flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      {t('drivers.details.activeDriver', 'Chauffeur Actif')} • ID: {selectedDriver.id.substring(0, 8)}
                    </p>
                  </div>
                </div>
              </DialogHeader>
            </div>
            
            <div className="p-8">
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="bg-slate-100/80 p-1 w-full justify-start gap-2 h-auto">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2">{t('drivers.details.overview', "Vue d'ensemble")}</TabsTrigger>
                  <TabsTrigger value="transactions" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2">{t('drivers.details.financialHistory', 'Historique Financier')}</TabsTrigger>
                  <TabsTrigger value="stock" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2">{t('drivers.common.stockRc', 'Stock R.C')}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-6 space-y-6 outline-none">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none bg-slate-50 p-6 shadow-inner">
                      <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">{t('drivers.details.currentDebt', 'Dette Actuelle')}</p>
                      <div className="text-3xl font-bold text-red-600">
                        {Math.abs(selectedDriver.debt).toLocaleString()} <span className="text-sm">DH</span>
                      </div>
                    </Card>
                    
                    <Card className="border-none bg-slate-50 p-6 shadow-inner">
                      <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">{t('drivers.stats.totalAdvances', 'Total Avances')}</p>
                      <div className="text-3xl font-bold text-emerald-600">
                        {Number(selectedDriver.advances || 0).toLocaleString()} <span className="text-sm">DH</span>
                      </div>
                    </Card>
                    
                    <Card className={`border-none p-6 shadow-inner ${
                      selectedDriver.balance > 0 ? 'bg-emerald-50/50' : 
                      selectedDriver.balance < 0 ? 'bg-red-50/50' : 
                      'bg-slate-50'
                    }`}>
                      <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">{t('drivers.details.netBalance', 'Balance Nette')}</p>
                      <div className={`text-3xl font-bold ${
                        selectedDriver.balance > 0 ? 'text-emerald-600' : 
                        selectedDriver.balance < 0 ? 'text-red-600' : 
                        'text-slate-600'
                      }`}>
                        {Math.abs(selectedDriver.balance).toLocaleString()} <span className="text-sm">DH</span>
                      </div>
                      <p className="text-xs mt-2 font-medium opacity-70">
                        {selectedDriver.balance > 0 ? t('drivers.details.creditForDriver', 'Crédit en faveur du chauffeur') : selectedDriver.balance < 0 ? t('drivers.details.remainingToPay', 'Reste à payer par le chauffeur') : t('drivers.details.balancedSituation', 'Situation équilibrée')}
                      </p>
                    </Card>
                  </div>
                  
                  {selectedDriver.debt > 0 && (
                    <Card className="p-6 border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">{t('drivers.details.repaymentProgress', 'Progression du Remboursement')}</h3>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                          {repaymentStats.progress.toFixed(1)}% {t('drivers.details.completed', 'Complété')}
                        </Badge>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
                        <div 
                          className="bg-indigo-600 h-3 rounded-full transition-all duration-500 shadow-sm" 
                          style={{ 
                            width: `${repaymentStats.progress}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t('drivers.details.repaymentHint', 'Basé sur le total des avances par rapport à la dette totale contractée.')}
                      </p>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="transactions" className="mt-6 outline-none">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <h3 className="font-bold text-slate-800">{t('drivers.details.latestTransactions', 'Dernières Transactions')}</h3>
                        <p className="text-xs text-slate-500">{t('drivers.details.last50Operations', 'Historique des 50 dernières opérations')}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleGeneratePDF(selectedDriver)} className="bg-white border-slate-200">
                        <Download className="w-4 h-4 mr-2 text-indigo-600" />
                        {t('drivers.actions.exportPdf', 'Exporter PDF')}
                      </Button>
                    </div>
                    
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="py-4 font-semibold">{t('drivers.table.date', 'Date')}</TableHead>
                            <TableHead className="py-4 font-semibold">{t('drivers.table.type', 'Type')}</TableHead>
                            <TableHead className="py-4 font-semibold">{t('drivers.table.amount', 'Montant')}</TableHead>
                            <TableHead className="py-4 font-semibold">{t('drivers.table.description', 'Description')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {driverTransactions && driverTransactions.length > 0 ? (
                            driverTransactions.map((tx, index) => {
                              const display = getTransactionDisplay(tx);
                              return (
                                <TableRow key={`${selectedDriver.id}-${tx.id ?? index}`} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                                  <TableCell className="py-4">{new Date(tx.date).toLocaleDateString()}</TableCell>
                                  <TableCell className="py-4">
                                    <Badge variant={(tx.type === 'debit' || tx.type === 'debt') ? 'destructive' : 'default'} className={(tx.type === 'credit' || tx.type === 'payment') ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none' : ''}>
                                      {(tx.type === 'debit' || tx.type === 'debt') ? t('drivers.status.debt', 'Dette') : t('drivers.status.payment', 'Paiement')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-4 font-bold">
                                    {display.amount.toLocaleString()} <span className="text-[10px] opacity-70">DH</span>
                                  </TableCell>
                                  <TableCell className="py-4 text-slate-600 italic text-sm">{display.description || '-'}</TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                                <div className="flex flex-col items-center">
                                  <DollarSign className="w-8 h-8 mb-2 opacity-20" />
                                  <p>{t('drivers.empty.noTransaction', 'Aucune transaction enregistrée')}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stock" className="mt-6 outline-none">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <h3 className="font-bold text-slate-800">{t('drivers.details.rcState', 'État du Stock R.C')}</h3>
                        <p className="text-xs text-slate-500">{t('drivers.details.bottlesInPossession', 'Bouteilles actuellement en possession du chauffeur')}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleGenerateRCPDF(selectedDriver)} className="bg-white border-slate-200">
                        <Download className="w-4 h-4 mr-2 text-purple-600" />
                        {t('drivers.actions.rcReport', 'Rapport R.C')}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2 px-2">
                          <Package className="w-4 h-4 text-purple-600" />
                          {t('drivers.details.detailedInventory', 'Inventaire Détallé')}
                        </h4>
                        <div className="rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/50">
                                <TableHead className="py-3 font-semibold">{t('drivers.table.bottleType', 'Type de Bouteille')}</TableHead>
                                <TableHead className="py-3 text-right font-semibold">{t('drivers.table.quantity', 'Quantité')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bottleTypes
                                .filter(type => !['BNG 12KG', 'Propane 34KG', 'Détendeur Clic-On'].includes(type.name))
                                .map((type) => {
                                  const qty = selectedDriver.remainingBottles?.[type.id] || 0;
                                  if (qty === 0) return null;
                                  return (
                                    <TableRow key={type.id} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                                      <TableCell className="py-3 font-medium">{type.name}</TableCell>
                                      <TableCell className="py-3 text-right">
                                        <Badge className="bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 font-bold px-3">
                                          {qty}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              {(!selectedDriver.remainingBottles || Object.values(selectedDriver.remainingBottles).every(q => q === 0)) && (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center py-8 text-slate-400">
                                    {t('drivers.empty.allReturned', 'Tout est retourné (Stock vide)')}
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 px-2">{t('drivers.details.summary', 'Résumé')}</h4>
                        <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-lg relative overflow-hidden group">
                          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Package className="w-32 h-32" />
                          </div>
                          <p className="text-indigo-100 font-medium mb-1 uppercase tracking-widest text-xs">{t('drivers.details.totalRcBottles', 'Total Bouteilles R.C')}</p>
                          <div className="text-5xl font-black mb-4">
                            {Object.values(selectedDriver.remainingBottles || {}).reduce((a, b) => a + b, 0)}
                          </div>
                          <div className="h-1 w-12 bg-white/30 rounded-full mb-4" />
                          <p className="text-indigo-100 text-sm leading-relaxed">
                            {t('drivers.details.totalRcHint', "Ce nombre représente le total des bouteilles pleines ou vides que le chauffeur n'a pas encore restituées au dépôt.")}
                          </p>
                        </div>
                        
                        <Button 
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-6 h-auto transition-all shadow-md"
                          onClick={() => {
                            setDetailsDialogOpen(false);
                            setBottleManagementOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          {t('drivers.actions.adjustRcStock', 'Ajuster manuellement le Stock R.C')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <DialogClose asChild>
                <Button variant="outline" className="px-8 border-slate-200 hover:bg-white transition-colors">{t('drivers.actions.close', 'Fermer')}</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bottle Management Dialog */}
      <Dialog open={bottleManagementOpen} onOpenChange={(open) => {
        setBottleManagementOpen(open);
        if (!open) setIsEditingRC(false);
      }}>
        <DialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
          <div className="bg-purple-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-white">{t('drivers.details.manageRcStock', 'Gestion Stock R.C')}</DialogTitle>
                    <p className="text-purple-100 text-xs mt-0.5">{selectedDriver?.name}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => selectedDriver && handleGenerateRCPDF(selectedDriver)}
                >
                  <Download className="w-5 h-5" />
                </Button>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6 bg-white">
            <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold py-3">{t('drivers.table.type', 'Type')}</TableHead>
                    <TableHead className="text-right font-semibold py-3">{t('drivers.table.quantity', 'Quantité')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDriver && bottleTypes
                    .filter(type => !['BNG 12KG', 'Propane 34KG', 'Détendeur Clic-On'].includes(type.name))
                    .map((type) => {
                      const qty = isEditingRC 
                      ? (editedBottles[type.id] || 0)
                      : (selectedDriver.remainingBottles?.[type.id] || 0);
                    
                    if (!isEditingRC && qty === 0) return null;
                    
                    return (
                      <TableRow key={type.id} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                        <TableCell className="font-medium py-3">{type.name}</TableCell>
                        <TableCell className="text-right py-3">
                          {isEditingRC ? (
                            <Input
                              type="number"
                              className="w-20 ml-auto text-right h-8 focus:ring-purple-500"
                              value={qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setEditedBottles(prev => ({ ...prev, [type.id]: val }));
                              }}
                            />
                          ) : (
                            <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100 font-bold px-3">
                              {qty}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!selectedDriver || (!isEditingRC && (!selectedDriver.remainingBottles || Object.values(selectedDriver.remainingBottles).every(q => q === 0)))) && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-slate-400 italic">
                        {t('drivers.empty.noPendingBottle', 'Aucune bouteille en attente')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-xs">{t('drivers.details.currentTotalRc', 'Total R.C Actuel')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-purple-600">
                    {isEditingRC 
                      ? Object.values(editedBottles).reduce((a, b) => a + b, 0)
                      : Object.values(selectedDriver?.remainingBottles || {}).reduce((a, b) => a + b, 0)}
                  </span>
                  <span className="text-xs font-medium text-slate-400">{t('drivers.common.units', 'UNITÉS')}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {!isEditingRC ? (
                <Button className="flex-1 bg-slate-900 hover:bg-slate-800" onClick={() => setIsEditingRC(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  {t('drivers.actions.editStock', 'Modifier le Stock')}
                </Button>
              ) : (
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700 shadow-md" onClick={handleSaveRC}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('drivers.actions.saveChanges', 'Sauvegarder les changements')}
                </Button>
              )}
              <Button variant="outline" className="flex-1 border-slate-200" onClick={() => setBottleManagementOpen(false)}>
                {t('drivers.actions.close', 'Fermer')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('drivers.delete.title', 'Supprimer le chauffeur')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('drivers.delete.description', 'Cette action va supprimer définitivement ce chauffeur de la liste. Les autres données ne seront pas modifiées.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('drivers.actions.cancel', 'Annuler')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (driverToDelete) {
                  await deleteDriver(driverToDelete.id);
                  setDriverToDelete(null);
                }
                setDeleteDialogOpen(false);
              }}
            >
              {t('drivers.actions.delete', 'Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Drivers;
