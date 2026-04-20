import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { Supplier } from '@/types';
import { 
  Factory as FactoryIcon, 
  Plus, 
  Truck, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Download, 
  Eye, 
  ArrowUpDown,
  History,
  Calendar,
  Search,
  ArrowRight,
  ArrowLeft,
  Settings2,
  UserPlus,
  Users,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Zap,
  FileText
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabaseService } from '@/lib/supabaseService';
import { useLanguage, useT } from '@/contexts/LanguageContext';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1
  }
};

interface FactoryOperation {
  id: string;
  truckId: string;
  supplierId?: string;
  driverName: string;
  sentBottles: Array<{
    bottleTypeId: string;
    quantity: number;
    status: 'empty' | 'defective';
  }>;
  receivedBottles: Array<{
    bottleTypeId: string;
    quantity: number;
  }>;
  date: string;
  receivedDate?: string;
  debtChange: number; // positive = debt to supplier, negative = debt reduction
  blReference?: string;
}

interface Invoice {
  id: string;
  supplierId: string;
  date: string;
  blReferences: string[];
  totalSent: number;
  totalReceived: number;
  totalAmount: number;
  status: 'pending' | 'paid';
  paymentMethod?: 'banque' | 'none';
}

interface SupplierDebt {
  bottleTypeId: string;
  emptyDebt: number; // Positive = supplier owes us empty bottles
  defectiveDebt: number; // Positive = supplier owes us compensation for defective bottles
}

interface DebtSettlement {
  id: string;
  date: string;
  supplierId: string;
  bottleTypeId: string;
  type: 'empty' | 'defective';
  quantity: number;
  description: string;
}

const Factory = () => {
  const { 
    trucks, 
    bottleTypes, 
    drivers, 
    updateBottleType, 
    addTransaction,
    addStockHistory,
    emptyBottlesStock,
    defectiveBottles,
    updateEmptyBottlesStockByBottleType,
    updateDefectiveBottlesStock,
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addCashOperation
  } = useApp();
  const t = useT();
  const { language } = useLanguage();
  const tf = (key: string, fallback: string) => t(`factory.pdf.${key}`, fallback);
  const tr = (frText: string, arText: string) => (language === 'ar' ? arText : frText);
  const uiDateLocale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const safeSuppliers = suppliers || [];
  const [localPurchasePrices, setLocalPurchasePrices] = useState<Record<string, number>>({});

  const handleDownloadInvoicePDF = (invoice: Invoice) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const supplier = safeSuppliers.find(s => s.id === invoice.supplierId);
      
      // Colors & Styles
      const primaryColor = [79, 70, 229]; // Indigo-600
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
      doc.text(tf('systemTitle', 'SYSTÈME DE GESTION DE DISTRIBUTION'), 14, 32);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(tf('invoiceTitle', 'FACTURE FOURNISSEUR'), 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N°: ${invoice.id}`, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');
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

      // Left Card Content (Invoice Info)
      drawInfoLabel(tf('invoiceDate', 'Date de Facturation'), format(new Date(invoice.date), 'dd MMMM yyyy', { locale: fr }), 20, 68);
      
      const statusLabel = invoice.status === 'paid' ? tf('statusPaid', 'PAYÉE') : tf('statusPending', 'EN ATTENTE');
      const statusColor = invoice.status === 'paid' ? accentColor : [245, 158, 11]; // Amber-500
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(tf('paymentStatus', 'STATUT DU PAIEMENT'), 20, 85);
      
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(20, 88, 30, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(statusLabel, 35, 91.5, { align: 'center' });

      // Right Card Content (Supplier Info)
      drawInfoLabel(tf('supplier', 'Fournisseur'), supplier?.name || 'N/A', 112, 68);
      drawInfoLabel(tf('blCount', 'Nombre de BL'), invoice.blReferences.length.toString(), 112, 85);

      // Movements Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(tf('blDetails', 'Détails des Bons de Livraison (BL)'), 14, 115);

      const tableData = invoice.blReferences.map(ref => {
        const op = factoryOperations.find(o => o.blReference === ref);
        const sent = op ? (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0) : 0;
        const received = op ? (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0) : 0;
        return [
          ref,
          op ? format(new Date(op.date), 'dd/MM/yyyy') : 'N/A',
          sent.toString(),
          received.toString(),
          (sent - received).toString()
        ];
      });

      autoTable(doc, {
        startY: 120,
        head: [[tf('blReference', 'Référence BL'), tf('date', 'Date'), tf('qtySent', 'Qté Envoyée'), tf('qtyReceived', 'Qté Reçue'), tf('difference', 'Différence')]],
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
          0: { halign: 'center' },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
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

      let finalY = (doc as any).lastAutoTable.finalY || 120;

      // Recap by Bottle Type
      const bottleTypeSummary: Record<string, { name: string, sent: number, received: number, price: number, amount: number }> = {};
      
      invoice.blReferences.forEach(ref => {
        const op = factoryOperations.find(o => o.blReference === ref);
        if (op) {
          (op.sentBottles || []).forEach(b => {
            if (!bottleTypeSummary[b.bottleTypeId]) {
              const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
              bottleTypeSummary[b.bottleTypeId] = { name: bt?.name || 'Inconnu', sent: 0, received: 0, price: bt?.purchasePrice || 0, amount: 0 };
            }
            bottleTypeSummary[b.bottleTypeId].sent += b.quantity;
          });
          (op.receivedBottles || []).forEach(b => {
            if (!bottleTypeSummary[b.bottleTypeId]) {
              const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
              bottleTypeSummary[b.bottleTypeId] = { name: bt?.name || 'Inconnu', sent: 0, received: 0, price: bt?.purchasePrice || 0, amount: 0 };
            }
            bottleTypeSummary[b.bottleTypeId].received += b.quantity;
            const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
            const price = bt?.purchasePrice || 0;
            bottleTypeSummary[b.bottleTypeId].amount += price * b.quantity;
          });
        }
      });

      if (Object.keys(bottleTypeSummary).length > 0) {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(tf('bottleSummary', 'Récapitulatif par Type de Bouteille'), 14, finalY + 15);

        const summaryTableData = Object.values(bottleTypeSummary).map(item => [
          item.name,
          item.sent.toString(),
          item.received.toString(),
          (item.sent - item.received).toString(),
            Number(item.price).toFixed(3),
            Number(item.amount).toFixed(3)
        ]);

        autoTable(doc, {
          startY: finalY + 20,
          head: [[tf('bottleType', 'Type de Bouteille'), tf('totalSent', 'Total Envoyé'), tf('totalReceived', 'Total Reçu'), tf('difference', 'Différence'), tf('unitPrice', 'Prix Unitaire'), tf('amount', 'Montant')]],
          body: summaryTableData,
          theme: 'striped',
          headStyles: {
            fillColor: secondaryColor,
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
          },
          styles: { fontSize: 8, cellPadding: 4 }
        });

        finalY = (doc as any).lastAutoTable.finalY || finalY + 40;
      }

      // Summary & Totals
      const summaryY = finalY + 15;
      
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(110, summaryY, 86, 30, 2, 2, 'F');
      
      const drawSummaryRow = (label: string, value: string, y: number, color = [30, 41, 59], bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(label, 115, y);
        doc.text(value, 190, y, { align: 'right' });
      };

      drawSummaryRow(`${tf('grandTotalSent', 'Total Général Envoyé')}:`, `${invoice.totalSent}`, summaryY + 10);
      drawSummaryRow(`${tf('grandTotalReceived', 'Total Général Reçu')}:`, `${invoice.totalReceived}`, summaryY + 20, [30, 41, 59], true);
      drawSummaryRow(`${tf('totalAmount', 'Montant Total')}:`, `${Number(invoice.totalAmount || 0).toFixed(3)}`, summaryY + 30, accentColor, true);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${tf('invoiceGeneratedBy', 'Facture générée par SFT GAZ le')} ${format(now, 'dd/MM/yyyy à HH:mm')}`,
          14,
          282
        );
        doc.text(
          `${tf('page', 'Page')} ${i} / ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`Facture_${invoice.id}_${format(new Date(invoice.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération de la facture PDF:", error);
      alert(`Erreur lors de la création de la facture PDF. Veuillez réessayer.`);
    }
  };

  const handleDownloadPDF = (operation: FactoryOperation) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const truck = trucks.find(t => t.id === operation.truckId);
      const totalSent = (operation.sentBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
      const totalReceived = (operation.receivedBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
      const totalAmount = (operation.receivedBottles || []).reduce((sum, bottle) => {
        const bt = bottleTypes.find(bt_ => bt_.id === bottle.bottleTypeId);
        const price = bt?.purchasePrice || 0;
        return sum + price * bottle.quantity;
      }, 0);
      const isFinished = (operation.receivedBottles || []).length > 0;

      // Colors & Styles
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const dangerColor = [220, 38, 38]; // Red-600
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
      doc.text(tf('systemTitle', 'SYSTÈME DE GESTION DE DISTRIBUTION'), 14, 32);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(tf('operationReportTitle', "RAPPORT D'OPÉRATION"), 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const reportRef = operation.blReference || `OP-${operation.id}`;
      doc.text(reportRef, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      // Left Card: Operation Details
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');

      // Right Card: Truck & Driver
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

      // Left Card Content
      drawInfoLabel(tf('operationDate', "Date de l'opération"), format(new Date(operation.date), 'dd MMMM yyyy', { locale: fr }), 20, 68);
      
      const statusLabel = isFinished ? tf('statusFinished', 'TERMINÉE') : tf('statusPending', 'EN ATTENTE');
      const statusColor = isFinished ? accentColor : [245, 158, 11]; // Amber-500
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(tf('status', 'STATUT'), 20, 85);
      
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(20, 88, 25, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(statusLabel, 32.5, 91.5, { align: 'center' });

      // Right Card Content
      const truckLabel = truck?.matricule || truck?.plateNumber || truck?.name || operation.truckId || 'N/A';
      drawInfoLabel(tf('driver', 'Chauffeur'), operation.driverName, 112, 68);
      drawInfoLabel(tf('truckPlate', 'Camion / Matricule'), truckLabel, 112, 85);

      // Movements Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(tf('movementDetails', 'Détails des Mouvements'), 14, 115);

      const tableData = [
        ...(operation.sentBottles || []).map(b => {
          const bt = bottleTypes.find(bt_ => bt_.id === b.bottleTypeId);
          return [
            { content: tf('outbound', 'SORTIE'), styles: { textColor: dangerColor, fontStyle: 'bold' } },
            bt?.name || 'N/A',
            b.status === 'empty' ? tf('empty', 'Vide') : tf('defective', 'Défectueux'),
            b.quantity.toString(),
            '',
            ''
          ];
        }),
        ...(operation.receivedBottles || []).map(b => {
          const bt = bottleTypes.find(bt_ => bt_.id === b.bottleTypeId);
          const price = bt?.purchasePrice || 0;
          return [
            { content: tf('inbound', 'ENTRÉE'), styles: { textColor: accentColor, fontStyle: 'bold' } },
            bt?.name || 'N/A',
            tf('full', 'Plein'),
            b.quantity.toString(),
            Number(price).toFixed(3),
            Number(price * b.quantity).toFixed(3)
          ];
        }),
      ];

      autoTable(doc, {
        startY: 120,
        head: [[tf('direction', 'Direction'), tf('bottleType', 'Type de Bouteille'), tf('state', 'État'), tf('quantity', 'Quantité'), tf('unitPrice', 'Prix Unitaire'), tf('amount', 'Montant')]],
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
          0: { halign: 'center', cellWidth: 30 },
          2: { halign: 'center', cellWidth: 40 },
          3: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'right', cellWidth: 30 }
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
      if (finalY < 230) {
        const summaryY = finalY + 15;
        
        // Totals Box
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(110, summaryY, 86, 40, 2, 2, 'F');
        
        const drawSummaryRow = (label: string, value: string, y: number, color = [30, 41, 59], bold = false) => {
          doc.setFont('helvetica', bold ? 'bold' : 'normal');
          doc.setFontSize(10);
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text(label, 115, y);
          doc.text(value, 190, y, { align: 'right' });
        };

        drawSummaryRow(`${tf('totalBottlesSent', 'Total Bouteilles Envoyées')}:`, `${totalSent}`, summaryY + 12);
        drawSummaryRow(`${tf('totalBottlesReceived', 'Total Bouteilles Reçues')}:`, `${totalReceived}`, summaryY + 22);
        drawSummaryRow(`${tf('totalAmount', 'Montant Total')}:`, `${Number(totalAmount).toFixed(3)}`, summaryY + 32);
        
        if (operation.debtChange !== 0) {
          const label = operation.debtChange > 0 ? `${tf('supplierDebt', 'Dette Fournisseur')}:` : `${tf('debtReduction', 'Réduction Dette')}:`;
          const value = `${Math.abs(operation.debtChange)} ${tf('units', 'unités')}`;
          const color = operation.debtChange > 0 ? dangerColor : accentColor;
          drawSummaryRow(label, value, summaryY + 42, color, true);
        }

        // Signature area
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(tf('managerSignature', 'Signature du Responsable'), 14, summaryY + 30);
        doc.line(14, summaryY + 32, 60, summaryY + 32);
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${tf('autoGeneratedBy', 'Document généré automatiquement par SFT GAZ le')} ${format(now, 'dd/MM/yyyy à HH:mm')}`,
          14,
          282
        );
        doc.text(
          `${tf('page', 'Page')} ${i} / ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`Rapport_Usine_${operation.id}_${format(new Date(operation.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert(`Erreur lors de la création du fichier PDF. Veuillez réessayer.`);
    }
  };

  // Nouveau: Export PDF pour toutes les opérations
  const exportOperationsPDF = () => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const dangerColor = [220, 38, 38]; // Red-600

      // Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(t('brand', 'SFT GAZ'), 14, 25);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(tf('operationsHistoryTitle', 'HISTORIQUE DES OPÉRATIONS USINE'), 210 - 14, 25, { align: 'right' });

      // Stats Summary before table
      const totalOps = factoryOperations.length;
      const finishedOps = factoryOperations.filter(op => (op.receivedBottles || []).length > 0).length;
      const totalSent_ = factoryOperations.reduce((sum, op) => sum + (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0), 0);
      const totalReceived_ = factoryOperations.reduce((sum, op) => sum + (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0), 0);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 45, 182, 20, 1, 1, 'F');
      
      const drawStat = (label: string, value: string, x: number) => {
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x, 53);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(value, x, 60);
        doc.setFont('helvetica', 'normal');
      };

      drawStat(tf('totalOperations', 'Total Opérations'), totalOps.toString(), 20);
      drawStat(tf('finished', 'Terminées'), finishedOps.toString(), 65);
      drawStat(tf('totalSent', 'Total Envoyé'), totalSent_.toString(), 110);
      drawStat(tf('totalReceived', 'Total Reçu'), totalReceived_.toString(), 155);

      autoTable(doc, {
        startY: 75,
        head: [[tf('date', 'Date'), tf('driver', 'Chauffeur'), tf('sent', 'Envoyé'), tf('received', 'Reçu'), tf('amount', 'Montant'), tf('status', 'Statut'), tf('debtDiff', 'Dette/Diff.')]],
        body: factoryOperations.map(op => {
          const sent = (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0);
          const received = (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0);
          const isFinished = (op.receivedBottles || []).length > 0;
          const amount = (op.receivedBottles || []).reduce((s, b) => {
            const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
            const price = bt?.purchasePrice || 0;
            return s + price * b.quantity;
          }, 0);
          
          return [
            format(new Date(op.date), 'dd/MM/yyyy'),
            op.driverName,
            sent.toString(),
            received.toString(),
            Number(amount).toFixed(3),
            { 
              content: isFinished ? tf('statusFinished', 'TERMINÉE') : tf('statusPending', 'EN ATTENTE'),
              styles: { textColor: isFinished ? accentColor : [245, 158, 11], fontStyle: 'bold' }
            },
            { 
              content: op.debtChange === 0 ? '0' : (op.debtChange > 0 ? `+${op.debtChange}` : op.debtChange.toString()),
              styles: { 
                textColor: op.debtChange > 0 ? dangerColor : op.debtChange < 0 ? accentColor : [30, 41, 59],
                fontStyle: op.debtChange !== 0 ? 'bold' : 'normal'
              }
            }
          ];
        }),
        theme: 'striped',
        headStyles: { 
          fillColor: primaryColor, 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 25 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 25 },
          5: { halign: 'center', cellWidth: 30 },
          6: { halign: 'right', cellWidth: 25 }
        },
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${tf('exportedAt', 'Exporté le')} ${format(now, 'dd/MM/yyyy HH:mm')} - ${t('brand', 'SFT GAZ')} v1.0`,
          14,
          282
        );
        doc.text(
          `${tf('page', 'Page')} ${i} ${tf('of', 'sur')} ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`Historique_Usine_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert(`Erreur lors de la création du fichier PDF. Veuillez réessayer.`);
    }
  };

  const [factoryOperations, setFactoryOperations] = useState<FactoryOperation[]>([]);
  const [debtSettlements, setDebtSettlements] = useState<DebtSettlement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settlementUnlocked, setSettlementUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem('factory_settlement_unlocked') === 'true'; } catch { return false; }
  });
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [pendingSettlementSupplierId, setPendingSettlementSupplierId] = useState<string | null>(null);

  // Statuts d'affichage des formulaires
  const [showSendForm, setShowSendForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showSupplierManagement, setShowSupplierManagement] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierBankAccount, setNewSupplierBankAccount] = useState('');
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedSupplierForInvoice, setSelectedSupplierForInvoice] = useState<string | null>(null);
  const [selectedBLsForInvoice, setSelectedBLsForInvoice] = useState<string[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string | null>(null);
  const [showEditInvoice, setShowEditInvoice] = useState(false);
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<'banque' | 'none'>('none');
  const selectedInvoiceSupplier = safeSuppliers.find(s => s.id === selectedSupplierForInvoice) || null;
  const [supplierFilterFromDate, setSupplierFilterFromDate] = useState('');
  const [supplierFilterToDate, setSupplierFilterToDate] = useState('');

  // Opération actuelle
  const [currentOperation, setCurrentOperation] = useState<Partial<FactoryOperation>>({});
  const [historyTab, setHistoryTab] = useState<'operations' | 'settlements' | 'invoices'>('operations');
  const [factoryCanvas, setFactoryCanvas] = useState<'creative' | 'focus'>('creative');
  const [commandCenterLane, setCommandCenterLane] = useState<'all' | 'pending' | 'received'>('all');
  const [commandCenterSearch, setCommandCenterSearch] = useState('');
  const [commandCenterSort, setCommandCenterSort] = useState<'priority' | 'recent'>('priority');
  const [pendingPriorityOrder, setPendingPriorityOrder] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [ops, settlements, invs] = await Promise.all([
        supabaseService.getAll<FactoryOperation>('factory_operations'),
        supabaseService.getAll<DebtSettlement>('debt_settlements'),
        supabaseService.getAll<Invoice>('factory_invoices'),
      ]);
      setFactoryOperations(ops);
      setDebtSettlements(settlements);
      setInvoices(invs);
    })();
  }, []);

  // Formulaire d'envoi au fournisseur
  const [sendForm, setSendForm] = useState({
    date: new Date(),
    truckId: '',
    supplierId: '',
    blReference: '',
    bottles: bottleTypes
      .filter(bt => !bt.name.includes('Détendeur'))
      .map(bt => ({
        bottleTypeId: bt.id,
        emptyQuantity: 0,
        defectiveQuantity: 0
      }))
  });

  // Effect to auto-generate BL Reference
  React.useEffect(() => {
    if (showSendForm) {
      const lastOpWithBL = [...factoryOperations]
        .filter(op => op.blReference && op.blReference.startsWith('BL-'))
        .sort((a, b) => (b.blReference || '').localeCompare(a.blReference || ''))[0];
      
      let nextNumber = 1;
      if (lastOpWithBL && lastOpWithBL.blReference) {
        const match = lastOpWithBL.blReference.match(/BL-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const nextBL = `BL-${nextNumber.toString().padStart(5, '0')}`;
      setSendForm(prev => ({ ...prev, blReference: nextBL }));
    }
  }, [showSendForm, factoryOperations]);
 
  useEffect(() => {
    bottleTypes.forEach((bt) => {
      let price = 0;
      if (bt.capacity === '12KG') price = 41.76;
      else if (bt.capacity === '6KG') price = 20.88;
      else if (bt.capacity === '3KG') price = 10.15;
      if (price > 0 && (!bt.purchasePrice || bt.purchasePrice === 0)) {
        updateBottleType(bt.id, { purchasePrice: price });
      }
    });
  }, [bottleTypes]);

  useEffect(() => {
    const handleQuickFactoryShortcuts = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'e') {
        event.preventDefault();
        setShowSendForm(true);
      } else if (key === 'r') {
        event.preventDefault();
        setShowReturnForm(true);
      } else if (key === 'f') {
        event.preventDefault();
        setShowSupplierManagement(true);
      } else if (key === '1') {
        event.preventDefault();
        setHistoryTab('operations');
        document.getElementById('factory-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (key === '2') {
        event.preventDefault();
        setHistoryTab('settlements');
        document.getElementById('factory-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (key === '3') {
        event.preventDefault();
        setHistoryTab('invoices');
        document.getElementById('factory-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('keydown', handleQuickFactoryShortcuts);
    return () => window.removeEventListener('keydown', handleQuickFactoryShortcuts);
  }, []);

  // Formulaire de réception
  const [returnForm, setReturnForm] = useState({
    date: new Date(),
    operationId: '',
    receivedBottles: bottleTypes.map(bt => ({
      bottleTypeId: bt.id,
      quantity: 0
    }))
  });

  // Formulaire de règlement
  const [settlementForm, setSettlementForm] = useState({
    supplierId: '',
    bottleTypeId: '',
    type: 'empty' as 'empty' | 'defective',
    quantity: 0,
    description: ''
  });

  const supplierDebt = factoryOperations.reduce((sum, op) => sum + op.debtChange, 0);
  const totalSent = factoryOperations.reduce((sum, op) => 
    sum + (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0), 0
  );
  const totalReceived = factoryOperations.reduce((sum, op) => 
    sum + (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0), 0
  );
  const invoiceRows = useMemo(() => {
    const invoicedBl = new Set(invoices.flatMap(inv => inv.blReferences || []));
    const standalone = factoryOperations
      .filter(op => op.blReference && !invoicedBl.has(op.blReference))
      .map((op) => {
        const sent = (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0);
        const received = (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0);
        const totalAmount = (op.receivedBottles || []).reduce((sum, b) => {
          const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
          const price = bt?.purchasePrice || 0;
          return sum + price * b.quantity;
        }, 0);
        return {
          source: 'single-bl' as const,
          id: `BL-${op.blReference}`,
          supplierId: op.supplierId || '',
          date: op.date,
          blReferences: [op.blReference],
          totalSent: sent,
          totalReceived: received,
          totalAmount,
          status: 'pending' as const,
          operationId: op.id
        };
      });
    const grouped = invoices.map(inv => ({ ...inv, source: 'invoice' as const }));
    return [...grouped, ...standalone].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, factoryOperations, bottleTypes]);
  const historySearchValue = commandCenterSearch.trim().toLowerCase();
  const filteredFactoryOperations = useMemo(() => {
    const base = factoryOperations.slice().reverse();
    if (!historySearchValue) return base;
    return base.filter((operation) => {
      const supplierName = safeSuppliers.find((s) => s.id === operation.supplierId)?.name || '';
      const haystack = [
        operation.driverName,
        operation.blReference || '',
        supplierName,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(historySearchValue);
    });
  }, [factoryOperations, safeSuppliers, historySearchValue]);
  const filteredDebtSettlements = useMemo(() => {
    if (!historySearchValue) return debtSettlements;
    return debtSettlements.filter((settlement) => {
      const supplierName = safeSuppliers.find((s) => s.id === settlement.supplierId)?.name || '';
      const bottleTypeName = bottleTypes.find((bt) => bt.id === settlement.bottleTypeId)?.name || '';
      const haystack = [
        supplierName,
        bottleTypeName,
        settlement.description || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(historySearchValue);
    });
  }, [debtSettlements, safeSuppliers, bottleTypes, historySearchValue]);
  const filteredInvoiceRows = useMemo(() => {
    if (!historySearchValue) return invoiceRows;
    return invoiceRows.filter((invoice) => {
      const supplierName = safeSuppliers.find((s) => s.id === invoice.supplierId)?.name || '';
      const blRefs = (invoice.blReferences || []).join(' ');
      const statusLabel = invoice.status === 'paid' ? 'payee paid' : 'en attente pending';
      const haystack = [invoice.id, supplierName, blRefs, statusLabel].join(' ').toLowerCase();
      return haystack.includes(historySearchValue);
    });
  }, [invoiceRows, safeSuppliers, historySearchValue]);
  const selectedInvoiceOps = useMemo(
    () =>
      factoryOperations.filter(op =>
        op.blReference &&
        selectedBLsForInvoice.includes(op.blReference) &&
        (!selectedSupplierForInvoice || op.supplierId === selectedSupplierForInvoice)
      ),
    [factoryOperations, selectedBLsForInvoice, selectedSupplierForInvoice]
  );
  const selectedInvoiceTotals = useMemo(() => {
    const totalSentSelected = selectedInvoiceOps.reduce(
      (sum, op) => sum + (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0),
      0
    );
    const totalReceivedSelected = selectedInvoiceOps.reduce(
      (sum, op) => sum + (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0),
      0
    );
    const totalAmountSelected = selectedInvoiceOps.reduce((sum, op) => {
      const amountOp = (op.receivedBottles || []).reduce((s, b) => {
        const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
        const price = bt?.purchasePrice || 0;
        return s + price * b.quantity;
      }, 0);
      return sum + amountOp;
    }, 0);
    return { totalSentSelected, totalReceivedSelected, totalAmountSelected };
  }, [selectedInvoiceOps, bottleTypes]);
  const openInvoiceFromOperation = (operation: FactoryOperation) => {
    if (!operation.supplierId || !operation.blReference) {
      alert(tr('Veuillez sélectionner un fournisseur et un BL valide', 'يرجى اختيار مورّد وBL صالح'));
      return;
    }
    setSelectedSupplierForInvoice(operation.supplierId);
    setSelectedBLsForInvoice([operation.blReference]);
    setShowInvoiceForm(true);
  };

  const getEmptyStock = (bottleTypeId: string): number => {
    const stock = emptyBottlesStock.find(s => s.bottleTypeId === bottleTypeId);
    return stock?.quantity || 0;
  };

  const getDefectiveStock = (bottleTypeId: string): number => {
    return defectiveBottles
      .filter(b => b.bottleTypeId === bottleTypeId)
      .reduce((sum, b) => sum + b.quantity, 0);
  };

  const getSupplierDebt = (supplierId: string, bottleTypeId: string): { emptyDebt: number; defectiveDebt: number } => {
    const supplier = safeSuppliers.find(s => s.id === supplierId);
    if (!supplier) return { emptyDebt: 0, defectiveDebt: 0 };
    return supplier.debts?.find(d => d.bottleTypeId === bottleTypeId) || {
      bottleTypeId,
      emptyDebt: 0,
      defectiveDebt: 0
    };
  };
  
  // Gérer le règlement de la dette avec le fournisseur
  const handleDebtSettlement = async () => {
    if (!settlementForm.supplierId || !settlementForm.bottleTypeId || settlementForm.quantity <= 0) {
      alert(tr('Veuillez choisir le fournisseur, le type de bouteille et saisir une quantité valide', 'يرجى اختيار المورّد ونوع القنينة وإدخال كمية صالحة'));
      return;
    }
    
    // Update supplier debts (negative change to reduce debt)
    if (settlementForm.type === 'empty') {
      updateSupplierDebt(settlementForm.supplierId, settlementForm.bottleTypeId, -settlementForm.quantity, 0);
      // Also update our empty stock
      updateEmptyBottlesStockByBottleType(
        settlementForm.bottleTypeId, 
        settlementForm.quantity,
        'factory',
        `${tr('Règlement dette', 'تسوية دين')} - ${safeSuppliers.find(s => s.id === settlementForm.supplierId)?.name || tr('Fournisseur inconnu', 'مورّد غير معروف')}`,
        {
          supplierId: settlementForm.supplierId
        }
      );
    } else {
      updateSupplierDebt(settlementForm.supplierId, settlementForm.bottleTypeId, 0, -settlementForm.quantity);
      // Also update our defective stock
      updateDefectiveBottlesStock(settlementForm.bottleTypeId, settlementForm.quantity);
    }
    
    // Add to settlements history
    const newSettlement: DebtSettlement = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      supplierId: settlementForm.supplierId,
      bottleTypeId: settlementForm.bottleTypeId,
      type: settlementForm.type,
      quantity: settlementForm.quantity,
      description: settlementForm.description || (language === 'ar'
        ? `تسوية دين ${settlementForm.type === 'empty' ? 'فارغ' : 'معيب'}`
        : `Règlement de dette ${settlementForm.type === 'empty' ? 'vides' : 'défectueux'}`)
    };
    
    const created = await supabaseService.create<DebtSettlement>('debt_settlements', newSettlement);
    const nextSettlement = created || newSettlement;
    setDebtSettlements(prev => [nextSettlement, ...prev]);

    // Add to global transactions
    addTransaction({
      type: 'factory_settlement',
      date: newSettlement.date,
      supplierId: newSettlement.supplierId,
      bottleTypeId: newSettlement.bottleTypeId,
      settlementType: newSettlement.type,
      quantity: newSettlement.quantity,
      description: newSettlement.description
    });
    
    // Reset form and close
    setSettlementForm({
      supplierId: '',
      bottleTypeId: '',
      type: 'empty',
      quantity: 0,
      description: ''
    });
    setShowSettlementForm(false);
  };

  // Update supplier debt
  const updateSupplierDebt = (supplierId: string, bottleTypeId: string, emptyChange: number, defectiveChange: number) => {
    const supplier = safeSuppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const updatedDebts = [...(supplier.debts || [])];
    const debtIndex = updatedDebts.findIndex(d => d.bottleTypeId === bottleTypeId);

    if (debtIndex >= 0) {
      updatedDebts[debtIndex] = {
        ...updatedDebts[debtIndex],
        emptyDebt: updatedDebts[debtIndex].emptyDebt + emptyChange,
        defectiveDebt: updatedDebts[debtIndex].defectiveDebt + defectiveChange
      };
    } else {
      updatedDebts.push({
        bottleTypeId,
        emptyDebt: emptyChange,
        defectiveDebt: defectiveChange
      });
    }

    updateSupplier(supplierId, { debts: updatedDebts });
  };

  const onClickReglerDette = (supplierId: string) => {
    if (!settlementUnlocked) {
      setPendingSettlementSupplierId(supplierId);
      setShowCodeDialog(true);
      return;
    }
    setSettlementForm({ ...settlementForm, supplierId });
    setShowSettlementForm(true);
  };

  const confirmUnlockSettlement = () => {
    if (codeInput === '123456789A') {
      setSettlementUnlocked(true);
      try { sessionStorage.setItem('factory_settlement_unlocked', 'true'); } catch {}
      setShowCodeDialog(false);
      const sid = pendingSettlementSupplierId;
      setPendingSettlementSupplierId(null);
      setCodeInput('');
      if (sid) {
        setSettlementForm({ ...settlementForm, supplierId: sid });
        setShowSettlementForm(true);
      }
    } else {
      alert(tr('Code invalide', 'رمز غير صالح'));
    }
  };

  const resetSupplierDebtAll = async (kind: 'empty' | 'defective') => {
    if (!window.confirm(tr('Confirmer la remise à zéro ?', 'تأكيد التصفير؟'))) return;
    for (const s of safeSuppliers) {
      const debts = (s.debts || []).map(d => ({
        ...d,
        emptyDebt: kind === 'empty' ? 0 : d.emptyDebt,
        defectiveDebt: kind === 'defective' ? 0 : d.defectiveDebt
      }));
      await updateSupplier(s.id, { debts });
    }
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    
    if (editingSupplier) {
      updateSupplier(editingSupplier.id, { name: newSupplierName, bankAccountName: newSupplierBankAccount.trim() || undefined });
    } else {
      addSupplier({
        id: Date.now().toString(),
        name: newSupplierName,
        bankAccountName: newSupplierBankAccount.trim() || undefined,
        debts: bottleTypes.map(bt => ({
          bottleTypeId: bt.id,
          emptyDebt: 0,
          defectiveDebt: 0
        })),
        transactionCount: 0
      });
    }
    
    setNewSupplierName('');
    setNewSupplierBankAccount('');
    setEditingSupplier(null);
    setShowAddSupplier(false);
  };

  const deleteFactoryOperation = async (operationId: string | number) => {
    if (!window.confirm(tr("Êtes-vous sûr de vouloir supprimer cette opération ?", 'هل أنت متأكد من حذف هذه العملية؟'))) return;
    const ok = await supabaseService.delete('factory_operations', operationId);
    if (ok) {
      setFactoryOperations(prev => prev.filter(op => String(op.id) !== String(operationId)));
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplierName(supplier.name);
    setNewSupplierBankAccount(String((supplier as any).bankAccountName || ''));
    setShowAddSupplier(true);
  };

  const handleSetSupplierBankAccount = async (supplierId: string) => {
    const supplier = safeSuppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    const current = String((supplier as any).bankAccountName || '').trim();
    const next = window.prompt(
      tr('Saisir le nom du compte banque du fournisseur', 'أدخل اسم الحساب البنكي للمورد'),
      current
    );
    if (next === null) return;
    await updateSupplier(supplier.id, { bankAccountName: next.trim() || undefined });
  };

  const handleSendToFactory = async () => {
    const truck = trucks.find(t => t.id === sendForm.truckId);
    if (!truck) return;
    
    const driver = drivers.find(d => d.id === truck.driverId);

    // Validate stock availability - Removed validation to allow sending "REMOQUE" even if stock is 0
    /*
    for (const bottle of sendForm.bottles) {
      const emptyStock = getEmptyStock(bottle.bottleTypeId);
      const defectiveStock = getDefectiveStock(bottle.bottleTypeId);
      
      if (bottle.emptyQuantity > emptyStock) {
        alert(`Stock insuffisant de bouteilles vides pour ${bottleTypes.find(bt => bt.id === bottle.bottleTypeId)?.name}`);
        return;
      }
      
      if (bottle.defectiveQuantity > defectiveStock) {
        alert(`Stock insuffisant de bouteilles défectueuses pour ${bottleTypes.find(bt => bt.id === bottle.bottleTypeId)?.name}`);
        return;
      }
    }
    */

    const sentBottles = sendForm.bottles
      .filter(b => b.emptyQuantity > 0 || b.defectiveQuantity > 0)
      .flatMap(b => [
        ...(b.emptyQuantity > 0 ? [{
          bottleTypeId: b.bottleTypeId,
          quantity: b.emptyQuantity,
          status: 'empty' as const
        }] : []),
        ...(b.defectiveQuantity > 0 ? [{
          bottleTypeId: b.bottleTypeId,
          quantity: b.defectiveQuantity,
          status: 'defective' as const
        }] : [])
      ]);

    // Update stocks and supplier debts
    sendForm.bottles.forEach(bottle => {
      if (bottle.emptyQuantity > 0) {
        updateEmptyBottlesStockByBottleType(
          bottle.bottleTypeId, 
          -bottle.emptyQuantity,
          'factory',
          `${tr('Envoi usine', 'إرسال للمصنع')} - ${truck.name} - ${safeSuppliers.find(s => s.id === sendForm.supplierId)?.name || tr('Fournisseur inconnu', 'مورّد غير معروف')}`,
          {
            truckId: sendForm.truckId,
            supplierId: sendForm.supplierId,
            blReference: sendForm.blReference,
            driverName: driver?.name
          }
        );
        // Supplier owes us empty bottles in return
        if (sendForm.supplierId) {
          updateSupplierDebt(sendForm.supplierId, bottle.bottleTypeId, bottle.emptyQuantity, 0);
        }
      }
      if (bottle.defectiveQuantity > 0) {
        updateDefectiveBottlesStock(bottle.bottleTypeId, -bottle.defectiveQuantity);
        // Supplier owes us compensation for defective bottles
        if (sendForm.supplierId) {
          updateSupplierDebt(sendForm.supplierId, bottle.bottleTypeId, 0, bottle.defectiveQuantity);
        }
      }
    });

    const operation: FactoryOperation = {
      id: Date.now().toString(),
      truckId: sendForm.truckId,
      supplierId: sendForm.supplierId,
      driverName: driver?.name || tr('N/A', 'غير متاح'),
      sentBottles,
      receivedBottles: [],
      date: sendForm.date ? sendForm.date.toISOString() : new Date().toISOString(),
      debtChange: 0,
      blReference: sendForm.blReference
    };

    const created = await supabaseService.create<FactoryOperation>('factory_operations', operation);
    const nextOperation = created || operation;
    setFactoryOperations(prev => [...prev, nextOperation]);
    setCurrentOperation(nextOperation);
    setSendForm({
      date: new Date(),
      truckId: '',
      supplierId: '',
      blReference: '',
      bottles: bottleTypes
        .filter(bt => !bt.name.includes('Détendeur'))
        .map(bt => ({
          bottleTypeId: bt.id,
          emptyQuantity: 0,
          defectiveQuantity: 0
        }))
    });
    setShowSendForm(false);

    // Add transaction
    await addTransaction({
      type: 'factory',
      date: sendForm.date ? sendForm.date.toISOString() : new Date().toISOString(),
      truckId: sendForm.truckId,
      supplierId: sendForm.supplierId,
      blReference: sendForm.blReference,
      bottleTypes: sentBottles.map(b => ({
        bottleTypeId: b.bottleTypeId,
        quantity: b.quantity
      })),
      totalValue: 0
    });
  };

  const handleReturnFromFactory = async () => {
    const operationId = returnForm.operationId;
    const operation = factoryOperations.find(op => String(op.id) === String(operationId));
    if (!operation) return;

    const receivedBottles = returnForm.receivedBottles.filter(b => b && b.quantity > 0);
    
    // Track bottles by type for debt calculation
    const sentByType: Record<string, { empty: number; defective: number }> = {};
    (operation.sentBottles || []).forEach(sentBottle => {
      if (!sentByType[sentBottle.bottleTypeId]) {
        sentByType[sentBottle.bottleTypeId] = {
          empty: 0,
          defective: 0
        };
      }
      
      if (sentBottle.status === 'empty') {
        sentByType[sentBottle.bottleTypeId].empty += sentBottle.quantity;
      } else if (sentBottle.status === 'defective') {
        sentByType[sentBottle.bottleTypeId].defective += sentBottle.quantity;
      }
    });
    
    // Calculate debt changes for each bottle type
    receivedBottles.forEach(receivedBottle => {
      const bottleTypeId = receivedBottle.bottleTypeId;
      const receivedQuantity = receivedBottle.quantity;
      const sent = sentByType[bottleTypeId] || { empty: 0, defective: 0 };
      
      // Always prioritize compensating empty bottles first, then defective bottles
      let remainingReceived = receivedQuantity;
      
      // First, compensate for empty bottles (reduce debt)
      const emptyCompensation = Math.min(remainingReceived, sent.empty);
      if (emptyCompensation > 0 && operation.supplierId) {
        updateSupplierDebt(operation.supplierId, bottleTypeId, -emptyCompensation, 0);
        remainingReceived -= emptyCompensation;
      }
      
      // Then, compensate for defective bottles (reduce debt)
      const defectiveCompensation = Math.min(remainingReceived, sent.defective);
      if (defectiveCompensation > 0 && operation.supplierId) {
        updateSupplierDebt(operation.supplierId, bottleTypeId, 0, -defectiveCompensation);
        remainingReceived -= defectiveCompensation;
      }
      
      // If we still have excess bottles received (unlikely but possible), it becomes a negative debt
      if (remainingReceived > 0 && operation.supplierId) {
        updateSupplierDebt(operation.supplierId, bottleTypeId, -remainingReceived, 0);
      }
    });

    // Calculate net debt change for the operation summary
    const totalSent = (operation.sentBottles || []).reduce((sum, b) => sum + b.quantity, 0);
    const totalReceivedQty = (receivedBottles || []).reduce((sum, b) => sum + b.quantity, 0);
    const debtChange = totalReceivedQty - totalSent;

    // Update operation
    const updated = await supabaseService.update<FactoryOperation>('factory_operations', operation.id, {
      receivedBottles,
      debtChange,
      receivedDate: returnForm.date ? returnForm.date.toISOString() : new Date().toISOString(),
    });
    if (updated) {
      setFactoryOperations(prev => prev.map(op => (String(op.id) === String(operation.id) ? updated : op)));
    }

    // Update stock with received bottles (full bottles go to inventory)
    receivedBottles.forEach(bottle => {
      const currentBT = bottleTypes.find(bt => bt.id === bottle.bottleTypeId);
      if (currentBT) {
        const currentRemaining = Number(currentBT.remainingQuantity || 0);
        const currentTotal = Number(currentBT.totalQuantity || 0);
        const qty = Number(bottle.quantity || 0);
        updateBottleType(bottle.bottleTypeId, {
          totalQuantity: currentTotal + qty,
          remainingQuantity: currentRemaining + qty
        });
        const noteParts = [
          operation.blReference ? `BL: ${operation.blReference}` : '',
          operation.supplierId ? `Fournisseur: ${safeSuppliers.find(s => s.id === operation.supplierId)?.name || operation.supplierId}` : '',
          operation.truckId ? `Camion: ${trucks.find(t => t.id === operation.truckId)?.name || operation.truckId}` : '',
          `Opération: ${operation.id}`
        ].filter(Boolean).join(' | ');
        addStockHistory({
          date: returnForm.date ? returnForm.date.toISOString() : new Date().toISOString(),
          bottleTypeId: bottle.bottleTypeId,
          bottleTypeName: currentBT.name,
          stockType: 'all',
          changeType: 'factory',
          quantity: qty,
          previousQuantity: currentRemaining,
          newQuantity: currentRemaining + qty,
          note: `Réception Usine | ${noteParts}`
        });

        // Add to global transactions
        addTransaction({
          type: 'factory_reception',
          date: returnForm.date ? returnForm.date.toISOString() : new Date().toISOString(),
          truckId: operation.truckId,
          supplierId: operation.supplierId,
          reference: operation.blReference || operation.id,
          bottleTypes: [{
            bottleTypeId: bottle.bottleTypeId,
            quantity: qty,
            status: 'received'
          }],
          description: `Réception Usine - ${qty} ${currentBT.name} | ${operation.blReference || operation.id}`,
          totalValue: (Number(currentBT.purchasePrice) || 0) * qty,
          details: {
            operationId: operation.id,
            blReference: operation.blReference
          }
        });
      }
    });

    setReturnForm({
      date: new Date(),
      operationId: '',
      receivedBottles: bottleTypes.map(bt => ({
        bottleTypeId: bt.id,
        quantity: 0
      }))
    });
    setShowReturnForm(false);
  };

  const deleteInvoice = async (invoiceId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      const ok = await supabaseService.delete('factory_invoices', invoiceId);
      if (ok) {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      }
    }
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice || !originalInvoiceId) return;
    const updated = await supabaseService.update<Invoice>('factory_invoices', originalInvoiceId, editingInvoice);
    if (updated) {
      setInvoices(prev => prev.map(inv => inv.id === originalInvoiceId ? updated : inv));
    }
    setShowEditInvoice(false);
    setEditingInvoice(null);
    setOriginalInvoiceId(null);
    alert('Facture mise à jour avec succès !');
  };

  const handleCreateInvoice = async () => {
    if (!selectedSupplierForInvoice || selectedBLsForInvoice.length === 0) {
      alert('Veuillez sélectionner un fournisseur et au moins un BL');
      return;
    }

    const { totalSentSelected, totalReceivedSelected, totalAmountSelected } = selectedInvoiceTotals;
    const status = invoicePaymentMethod === 'banque' ? 'paid' : 'pending';
    const supplierBankAccount = String((selectedInvoiceSupplier as any)?.bankAccountName || '').trim();

    if (invoicePaymentMethod === 'banque' && !supplierBankAccount) {
      alert(tr('Veuillez renseigner le compte fournisseur avant paiement banque.', 'يرجى إدخال حساب المورد قبل الدفع البنكي.'));
      return;
    }

    const newInvoice: Invoice = {
      id: `INV-${Date.now()}`,
      supplierId: selectedSupplierForInvoice,
      date: new Date().toISOString(),
      blReferences: selectedBLsForInvoice,
      totalSent: totalSentSelected,
      totalReceived: totalReceivedSelected,
      totalAmount: totalAmountSelected,
      status,
      paymentMethod: invoicePaymentMethod
    };

    const created = await supabaseService.create<Invoice>('factory_invoices', newInvoice);
    const finalInvoice = created || newInvoice;
    
    setInvoices(prev => [finalInvoice, ...prev]);
    
    // Add to global transactions
    addTransaction({
      type: 'factory_invoice',
      date: finalInvoice.date,
      supplierId: finalInvoice.supplierId,
      totalValue: finalInvoice.totalAmount,
      reference: finalInvoice.id,
      description: `Facture Usine - ${finalInvoice.blReferences?.length || 0} BLs`,
      details: {
        blReferences: finalInvoice.blReferences,
        totalSent: finalInvoice.totalSent,
        totalReceived: finalInvoice.totalReceived
      }
    });
    
    if (status === 'paid' && (finalInvoice.totalAmount || 0) > 0) {
      await addCashOperation({
        date: new Date().toISOString(),
        name: `Paiement Facture ${finalInvoice.id}${supplierBankAccount ? ` | ${supplierBankAccount}` : ''}`,
        amount: finalInvoice.totalAmount || 0,
        type: 'retrait',
        accountAffected: 'banque',
        accountDetails: supplierBankAccount || undefined,
        status: 'validated',
      });
    }

    setShowInvoiceForm(false);
    setSelectedBLsForInvoice([]);
    setSelectedSupplierForInvoice(null);
    setInvoicePaymentMethod('none');
    setHistoryTab('invoices');
    alert('Facture créée avec succès !');
  };
  
  const handleToggleInvoicePaid = async (invoice: Invoice) => {
    const invoiceSupplier = safeSuppliers.find(s => s.id === invoice.supplierId);
    const supplierBankAccount = String((invoiceSupplier as any)?.bankAccountName || '').trim();
    if (invoice.status === 'pending') {
      const amount = invoice.totalAmount || 0;
      if (!supplierBankAccount) {
        alert(tr('Ce fournisseur n’a pas de compte banque configuré.', 'هذا المورد ليس لديه حساب بنك مضبوط.'));
        return;
      }
      if (amount > 0) {
        await addCashOperation({
          date: new Date().toISOString(),
          name: `Paiement Facture ${invoice.id}${supplierBankAccount ? ` | ${supplierBankAccount}` : ''}`,
          amount,
          type: 'retrait',
          accountAffected: 'banque',
          accountDetails: supplierBankAccount || undefined,
          status: 'validated',
        });
      }
      const updated = await supabaseService.update<Invoice>('factory_invoices', invoice.id, { status: 'paid' });
      if (updated) {
        setInvoices(prev => prev.map(inv => inv.id === invoice.id ? updated : inv));
      }
    } else {
      const amount = invoice.totalAmount || 0;
      if (amount > 0) {
        await addCashOperation({
          date: new Date().toISOString(),
          name: `Annulation Paiement Facture ${invoice.id}${supplierBankAccount ? ` | ${supplierBankAccount}` : ''}`,
          amount,
          type: 'versement',
          accountAffected: 'banque',
          accountDetails: supplierBankAccount || undefined,
          status: 'validated',
        });
      }
      const updated = await supabaseService.update<Invoice>('factory_invoices', invoice.id, { status: 'pending' });
      if (updated) {
        setInvoices(prev => prev.map(inv => inv.id === invoice.id ? updated : inv));
      }
    }
  };

  const pendingOperations = factoryOperations.filter(op => (op.receivedBottles || []).length === 0);
  const completedOperations = factoryOperations.length - pendingOperations.length;
  const completionRate = factoryOperations.length > 0 ? Math.round((completedOperations / factoryOperations.length) * 100) : 0;
  const emptyDebtTotal = safeSuppliers.reduce((s, sup) => s + (sup.debts?.reduce((acc, d) => acc + d.emptyDebt, 0) || 0), 0);
  const defectiveDebtTotal = safeSuppliers.reduce((s, sup) => s + (sup.debts?.reduce((acc, d) => acc + d.defectiveDebt, 0) || 0), 0);
  const topSupplierInsight = safeSuppliers
    .map(supplier => ({
      name: supplier.name,
      ops: factoryOperations.filter(op => op.supplierId === supplier.id).length
    }))
    .sort((a, b) => b.ops - a.ops)[0] || { name: 'N/A', ops: 0 };
  const delayedOperations = pendingOperations
    .map((op) => {
      const opDate = new Date(op.date);
      const diffDays = Number.isNaN(opDate.getTime()) ? 0 : Math.floor((Date.now() - opDate.getTime()) / (1000 * 60 * 60 * 24));
      return { ...op, diffDays };
    })
    .filter((op) => op.diffDays >= 2)
    .sort((a, b) => b.diffDays - a.diffDays);
  const supplierPurchaseStats = useMemo(() => {
    const bySupplier: Record<string, { total: number; count: number }> = {};
    invoices.forEach((inv) => {
      const invDay = String(inv.date || '').slice(0, 10);
      if (supplierFilterFromDate && invDay < supplierFilterFromDate) return;
      if (supplierFilterToDate && invDay > supplierFilterToDate) return;
      const sid = String(inv.supplierId || '');
      if (!sid) return;
      if (!bySupplier[sid]) bySupplier[sid] = { total: 0, count: 0 };
      bySupplier[sid].total += Number(inv.totalAmount || 0);
      bySupplier[sid].count += 1;
    });
    return bySupplier;
  }, [invoices, supplierFilterFromDate, supplierFilterToDate]);
  const timelineOperations = [...factoryOperations]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
  const activityByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = format(date, 'yyyy-MM-dd');
    return {
      key,
      label: format(date, 'dd/MM'),
      count: factoryOperations.filter((op) => {
        const opDate = new Date(op.date);
        return !Number.isNaN(opDate.getTime()) && format(opDate, 'yyyy-MM-dd') === key;
      }).length
    };
  });
  const maxActivityCount = Math.max(1, ...activityByDay.map((day) => day.count));
  const priorityByOperationId = useMemo(() => {
    const now = Date.now();
    return factoryOperations.reduce<Record<string, number>>((acc, op) => {
      const dateMs = new Date(op.date).getTime();
      const ageDays = Number.isNaN(dateMs) ? 0 : Math.max(0, Math.floor((now - dateMs) / (1000 * 60 * 60 * 24)));
      const sent = (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0);
      const received = (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0);
      const pendingGap = Math.max(0, sent - received);
      const isPending = (op.receivedBottles || []).length === 0;
      const score = (ageDays * 8) + (pendingGap * 2) + (isPending ? 20 : 0) + Math.round(Math.abs(op.debtChange || 0) * 4);
      acc[op.id] = score;
      return acc;
    }, {});
  }, [factoryOperations]);
  const commandCenterOperations = useMemo(() => {
    return [...factoryOperations]
      .filter((op) => {
        const matchesLane =
          commandCenterLane === 'all' ||
          (commandCenterLane === 'pending' && (op.receivedBottles || []).length === 0) ||
          (commandCenterLane === 'received' && (op.receivedBottles || []).length > 0);
        const matchesSearch = commandCenterSearch.trim().length === 0
          ? true
          : `${op.driverName} ${op.blReference || ''}`.toLowerCase().includes(commandCenterSearch.toLowerCase());
        return matchesLane && matchesSearch;
      })
      .sort((a, b) => {
        if (commandCenterSort === 'priority') {
          const priorityDiff = (priorityByOperationId[b.id] || 0) - (priorityByOperationId[a.id] || 0);
          if (priorityDiff !== 0) return priorityDiff;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 14);
  }, [factoryOperations, commandCenterLane, commandCenterSearch, commandCenterSort, priorityByOperationId]);
  const commandCenterPendingLane = commandCenterOperations
    .filter((op) => (op.receivedBottles || []).length === 0)
    .sort((a, b) => {
      const orderA = pendingPriorityOrder.indexOf(a.id);
      const orderB = pendingPriorityOrder.indexOf(b.id);
      if (orderA !== -1 || orderB !== -1) {
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      }
      if (commandCenterSort === 'priority') {
        return (priorityByOperationId[b.id] || 0) - (priorityByOperationId[a.id] || 0);
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  const commandCenterReceivedLane = commandCenterOperations
    .filter((op) => (op.receivedBottles || []).length > 0);
  const commandCenterReceived = commandCenterOperations.filter((op) => (op.receivedBottles || []).length > 0).length;
  const commandCenterPending = commandCenterOperations.length - commandCenterReceived;
  const commandCenterBalance = commandCenterOperations.reduce((acc, op) => {
    const sent = (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0);
    const received = (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0);
    return acc + (received - sent);
  }, 0);
  useEffect(() => {
    setPendingPriorityOrder((prev) => {
      const pendingIds = pendingOperations.map((op) => op.id);
      const kept = prev.filter((id) => pendingIds.includes(id));
      const missing = pendingIds
        .filter((id) => !kept.includes(id))
        .sort((a, b) => (priorityByOperationId[b] || 0) - (priorityByOperationId[a] || 0));
      const next = [...kept, ...missing];
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [pendingOperations, priorityByOperationId]);
  const movePendingPriority = (operationId: string, direction: 'up' | 'down') => {
    setPendingPriorityOrder((prev) => {
      const currentIndex = prev.indexOf(operationId);
      if (currentIndex === -1) return prev;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
  };
  const startReceiveFromCenter = (operationId: string) => {
    setReturnForm({
      date: new Date(),
      operationId,
      receivedBottles: bottleTypes.map((bt) => ({
        bottleTypeId: bt.id,
        quantity: 0
      }))
    });
    setShowReturnForm(true);
  };
  const scrollToFactorySection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={factoryCanvas === 'creative' ? 'app-page-shell p-4 md:p-8 space-y-8 bg-slate-50/30 min-h-screen' : 'app-page-shell p-4 md:p-6 space-y-5 bg-slate-100/40 min-h-screen'}
    >
      <motion.div variants={itemVariants}>
        <Card id="factory-hero" className="overflow-hidden border-0 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white shadow-2xl">
          <CardContent className="p-0">
            <div className="px-6 py-6 md:px-8 md:py-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-3">
                  <Badge className="bg-white/15 border-white/20 text-white hover:bg-white/20">
                    <FactoryIcon className="w-3.5 h-3.5 mr-1.5" />
                    {tr('Supplier Studio', 'استوديو المورّدين')}
                  </Badge>
                  <div>
                    <h1 className="app-page-title text-3xl md:text-4xl font-black tracking-tight">{tr('Gestion des Fournisseurs', 'إدارة المورّدين')}</h1>
                    <p className="app-page-subtitle text-slate-200/90 mt-1">{tr('Pilotage créatif des fournisseurs, flux et dettes avec conservation complète du comportement métier.', 'قيادة ذكية للمورّدين والتدفقات والديون مع الحفاظ الكامل على منطق العمل.')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[280px]">
                  <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-wider text-slate-200">{tr('Opérations totales', 'إجمالي العمليات')}</div>
                    <div className="text-2xl font-black">{factoryOperations.length}</div>
                  </div>
                  <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-wider text-slate-200">{tr('En attente retour', 'بانتظار الإرجاع')}</div>
                    <div className="text-2xl font-black">{pendingOperations.length}</div>
                  </div>
                  <div className="app-panel-soft rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-wider text-slate-200">{tr('Taux de complétion', 'معدل الإكمال')}</div>
                    <div className="text-2xl font-black">{completionRate}%</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowSendForm(true)} className="bg-white text-slate-900 hover:bg-slate-100">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {tr('Envoi Usine', 'إرسال للمصنع')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowReturnForm(true)} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {tr('Réception Usine', 'استلام من المصنع')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowSupplierManagement(true)} className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">
                  <CreditCard className="w-4 h-4 mr-2" />
                  {tr('Gestion Fournisseurs', 'إدارة المورّدين')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFactoryCanvas(prev => prev === 'creative' ? 'focus' : 'creative')} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  <Settings2 className="w-4 h-4 mr-2" />
                  {factoryCanvas === 'creative' ? tr('Mode Focus', 'وضع التركيز') : tr('Mode Creative', 'الوضع الإبداعي')}
                </Button>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                  <div className="text-xs text-slate-200 mb-1">{tr('Fournisseur dominant', 'المورّد المهيمن')}</div>
                  <div className="font-bold">{topSupplierInsight.name}</div>
                  <div className="text-sm text-slate-300">{topSupplierInsight.ops} {tr('opération(s)', 'عملية')}</div>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                  <div className="text-xs text-slate-200 mb-1">{tr('Factures en attente', 'فواتير قيد الانتظار')}</div>
                  <div className="font-bold">{invoices.filter(inv => inv.status === 'pending').length}</div>
                  <div className="text-sm text-slate-300">{tr('sur', 'من')} {invoices.length} {tr('facture(s)', 'فاتورة')}</div>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                  <div className="text-xs text-slate-200 mb-1">{tr('Équilibre flux', 'توازن التدفق')}</div>
                  <div className="font-bold">{Math.max(0, totalSent - totalReceived)} {tr('bouteille(s)', 'قنينة')}</div>
                  <div className="text-sm text-slate-300">{tr('écart entre envoi et réception', 'الفارق بين الإرسال والاستلام')}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => scrollToFactorySection('factory-stats')} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  {tr('KPIs', 'مؤشرات الأداء')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => scrollToFactorySection('factory-debts')} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  {tr('Dettes', 'الديون')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setHistoryTab('operations'); scrollToFactorySection('factory-history'); }} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  {tr('Chargements', 'الشحنات')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setHistoryTab('settlements'); scrollToFactorySection('factory-history'); }} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  {tr('Règlements', 'التسويات')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setHistoryTab('invoices'); scrollToFactorySection('factory-history'); }} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  {tr('Factures', 'الفواتير')}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge className="bg-white/10 border-white/20 text-slate-100">{tr('Alt+E Envoi', 'Alt+E إرسال')}</Badge>
                <Badge className="bg-white/10 border-white/20 text-slate-100">{tr('Alt+R Réception', 'Alt+R استلام')}</Badge>
                <Badge className="bg-white/10 border-white/20 text-slate-100">{tr('Alt+F Fournisseurs', 'Alt+F الموردون')}</Badge>
                <Badge className="bg-white/10 border-white/20 text-slate-100">{tr('Alt+1/2/3 Historique', 'Alt+1/2/3 السجل')}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div id="factory-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: tr('Total Envoyé', 'إجمالي المرسل'), value: totalSent, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: tr('Total Reçu', 'إجمالي المستلم'), value: totalReceived, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: tr('Opérations en attente', 'عمليات قيد الانتظار'), value: pendingOperations.length, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: tr('Dette Fournisseur (V)', 'دين المورد (فارغ)'), value: emptyDebtTotal, icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: tr('Défectueux en attente', 'معيب قيد الانتظار'), value: defectiveDebtTotal, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' }
        ].map((stat, idx) => (
          <motion.div 
            key={idx} 
            variants={itemVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="relative group"
          >
            <Card className="border-0 shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-4 ${stat.bg} rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <h3 className={`text-2xl font-black ${stat.color}`}>{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <div id="factory-debts" className="flex justify-end gap-2 mt-2">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => resetSupplierDebtAll('empty')}>
          {tr('Remise à zéro Dette (V)', 'تصفير دين الفارغ')}
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => resetSupplierDebtAll('defective')}>
          {tr('Remise à zéro Défectueux', 'تصفير المعيب')}
        </Button>
      </div>

      <motion.div variants={itemVariants}>
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-slate-200/80 shadow-sm bg-gradient-to-b from-white to-slate-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                {tr('Alertes intelligentes V2', 'تنبيهات ذكية V2')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={delayedOperations.length > 0 ? 'destructive' : 'secondary'}>
                  {delayedOperations.length} {tr('opération(s) en retard (+2 jours)', 'عملية متأخرة (+2 يوم)')}
                </Badge>
                <Badge variant="outline">
                  {tr('Complétées', 'مكتملة')}: {completedOperations}/{factoryOperations.length}
                </Badge>
              </div>
              {delayedOperations.length > 0 ? (
                delayedOperations.slice(0, 4).map((op) => (
                  <div key={op.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{op.blReference || `OP-${op.id}`}</div>
                      <div className="text-xs text-slate-500">{op.driverName}</div>
                    </div>
                    <Badge variant="outline" className="text-amber-700 border-amber-300">
                      {op.diffDays} {tr('jours en attente', 'أيام انتظار')}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 text-sm font-medium">
                  {tr('Aucun retard détecté pour le moment.', 'لا يوجد أي تأخير حاليًا.')}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                {tr('Timeline Express', 'الخط الزمني السريع')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timelineOperations.map((op) => {
                const isPending = (op.receivedBottles || []).length === 0;
                return (
                  <div key={op.id} className="rounded-lg border border-slate-100 p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{op.blReference || `OP-${op.id}`}</span>
                      <Badge variant={isPending ? 'secondary' : 'outline'}>
                        {isPending ? tr('En attente', 'قيد الانتظار') : tr('Reçu', 'تم الاستلام')}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{format(new Date(op.date), 'dd/MM/yyyy')} · {op.driverName}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              {tr('Activité des 7 derniers jours', 'نشاط آخر 7 أيام')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              {activityByDay.map((day) => (
                <div key={day.key} className="rounded-xl border border-slate-200 p-3 bg-white">
                  <div className="text-xs text-slate-500 mb-2">{day.label}</div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.max(8, Math.round((day.count / maxActivityCount) * 100))}%` }}
                    />
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-2">{day.count} {tr('op.', 'عملية')}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/95 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  {tr('Command Center V4', 'مركز القيادة V4')}
                </CardTitle>
                <p className="text-slate-200 text-sm">{tr('Priorisation intelligente, contrôle de file en style drag et actions rapides par lane.', 'أولوية ذكية، تحكم بالطوابير بأسلوب سحب وإفلات، وإجراءات سريعة لكل مسار.')}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 min-w-[290px]">
                <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-200">{tr('Visible', 'مرئي')}</div>
                  <div className="text-lg font-black">{commandCenterOperations.length}</div>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-200">{tr('Pending', 'قيد الانتظار')}</div>
                  <div className="text-lg font-black">{commandCenterPending}</div>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-200">{tr('Received', 'تم الاستلام')}</div>
                  <div className="text-lg font-black">{commandCenterReceived}</div>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-200">{tr('Balance', 'الرصيد')}</div>
                  <div className="text-lg font-black">{commandCenterBalance}</div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <Button
                  size="sm"
                  variant={commandCenterLane === 'all' ? 'secondary' : 'ghost'}
                  onClick={() => setCommandCenterLane('all')}
                  className={commandCenterLane === 'all' ? 'bg-white shadow-sm text-slate-900 rounded-lg font-bold' : 'text-slate-500 rounded-lg'}
                >
                  {tr('Tout', 'الكل')}
                </Button>
                <Button
                  size="sm"
                  variant={commandCenterLane === 'pending' ? 'secondary' : 'ghost'}
                  onClick={() => setCommandCenterLane('pending')}
                  className={commandCenterLane === 'pending' ? 'bg-white shadow-sm text-amber-700 rounded-lg font-bold' : 'text-slate-500 rounded-lg'}
                >
                  {tr('En attente', 'قيد الانتظار')}
                </Button>
                <Button
                  size="sm"
                  variant={commandCenterLane === 'received' ? 'secondary' : 'ghost'}
                  onClick={() => setCommandCenterLane('received')}
                  className={commandCenterLane === 'received' ? 'bg-white shadow-sm text-emerald-700 rounded-lg font-bold' : 'text-slate-500 rounded-lg'}
                >
                  {tr('Reçues', 'مستلمة')}
                </Button>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <Button
                  size="sm"
                  variant={commandCenterSort === 'priority' ? 'secondary' : 'ghost'}
                  onClick={() => setCommandCenterSort('priority')}
                  className={commandCenterSort === 'priority' ? 'bg-white shadow-sm text-indigo-700 rounded-lg font-bold' : 'text-slate-500 rounded-lg'}
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  {tr('Priority', 'الأولوية')}
                </Button>
                <Button
                  size="sm"
                  variant={commandCenterSort === 'recent' ? 'secondary' : 'ghost'}
                  onClick={() => setCommandCenterSort('recent')}
                  className={commandCenterSort === 'recent' ? 'bg-white shadow-sm text-slate-900 rounded-lg font-bold' : 'text-slate-500 rounded-lg'}
                >
                  {tr('Récent', 'الأحدث')}
                </Button>
              </div>
              <div className="relative md:ml-auto md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={commandCenterSearch}
                  onChange={(e) => setCommandCenterSearch(e.target.value)}
                  placeholder={tr('BL ou chauffeur...', 'BL أو السائق...')}
                  className="pl-9 h-10 rounded-xl border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div className="grid xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-amber-800 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    {tr('File En Attente', 'قائمة الانتظار')}
                  </h4>
                  <Badge variant="outline" className="border-amber-300 text-amber-700">{commandCenterPending}</Badge>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {commandCenterPendingLane.map((op, index) => {
                    const sent = (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0);
                    const score = priorityByOperationId[op.id] || 0;
                    const canMoveUp = index > 0;
                    const canMoveDown = index < commandCenterPendingLane.length - 1;
                    return (
                      <div key={op.id} className="rounded-xl border border-amber-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">{op.blReference || `OP-${op.id}`}</div>
                          <Badge variant="secondary">{tr('Pending', 'قيد الانتظار')}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{format(new Date(op.date), 'dd/MM/yyyy')} · {op.driverName}</div>
                        <div className="text-xs mt-1 flex items-center gap-2">
                          <span className="text-amber-700">{tr('Envoyé', 'مرسل')}: {sent}</span>
                          <Badge variant="outline" className="text-indigo-700 border-indigo-200">{tr('Score', 'النقاط')} {score}</Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canMoveUp} onClick={() => movePendingPriority(op.id, 'up')}>
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canMoveDown} onClick={() => movePendingPriority(op.id, 'down')}>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 ml-auto text-xs" onClick={() => startReceiveFromCenter(op.id)}>
                            {tr('Démarrer réception', 'بدء الاستلام')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {commandCenterPendingLane.length === 0 && (
                    <div className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-amber-700 font-medium">
                      {tr('Aucune opération en attente dans la vue actuelle.', 'لا توجد عمليات قيد الانتظار في العرض الحالي.')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {tr('File Reçue', 'قائمة المستلم')}
                  </h4>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">{commandCenterReceived}</Badge>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {commandCenterReceivedLane.map((op) => {
                    const sent = (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0);
                    const received = (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0);
                    return (
                      <div key={op.id} className="rounded-xl border border-emerald-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">{op.blReference || `OP-${op.id}`}</div>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700">{tr('Reçue', 'مستلمة')}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{format(new Date(op.date), 'dd/MM/yyyy')} · {op.driverName}</div>
                        <div className="text-xs mt-1 flex items-center gap-2">
                          <span className="text-slate-600">{tr('Envoyé', 'مرسل')}: {sent}</span>
                          <span className="text-emerald-700">{tr('Reçu', 'مستلم')}: {received}</span>
                          <span className={received - sent >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                            Δ {received - sent}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setHistoryTab('operations'); scrollToFactorySection('factory-history'); }}>
                            {tr('Voir dans historique', 'عرض في السجل')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {commandCenterReceivedLane.length === 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm text-emerald-700 font-medium">
                      {tr('Aucune opération reçue dans la vue actuelle.', 'لا توجد عمليات مستلمة في العرض الحالي.')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500 mb-1">{tr('Intensité File Pending', 'حدة قائمة الانتظار')}</div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-slate-900">{commandCenterPending}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500 mb-1">{tr('Capacité de Clôture', 'قدرة الإغلاق')}</div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">{commandCenterReceived}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500 mb-1">{tr('Balance Visible', 'الرصيد المرئي')}</div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span className={commandCenterBalance >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>
                    {commandCenterBalance}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Send Form Dialog */}
      <Dialog open={showSendForm} onOpenChange={setShowSendForm}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="">
                  <DialogTitle className="text-2xl font-black">{tr("Envoi à l'Usine", 'إرسال إلى المصنع')}</DialogTitle>
                  <DialogDescription className="text-slate-400 mt-1">
                    {tr('Enregistrer un nouvel envoi de bouteilles vides ou défectueuses au fournisseur', 'تسجيل إرسال جديد لقنينات فارغة أو معيبة إلى المورّد')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-8 bg-white max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-sm font-bold text-slate-700">{tr('Référence BL (Bon de Livraison)', 'مرجع BL (سند التسليم)')}</Label>
                <div className="relative">
                  <Input
                    value={sendForm.blReference}
                    onChange={(e) => setSendForm({...sendForm, blReference: e.target.value})}
                    placeholder="BL-00000"
                    className="h-12 border-slate-200 rounded-xl bg-slate-50 pl-10 font-bold"
                  />
                  <History className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold text-slate-700">{tr('Choisir le camion (remorque)', 'اختر الشاحنة (المقطورة)')}</Label>
                <Select 
                  value={sendForm.truckId} 
                  onValueChange={(value) => setSendForm({...sendForm, truckId: value})}
                >
                  <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 flex-row">
                    <SelectValue placeholder={tr('Choisir le camion...', 'اختر الشاحنة...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.filter(truck => truck.truckType === 'remorque').map(truck => {
                      const driver = drivers.find(d => d.id === truck.driverId);
                      return (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.matricule} - {driver?.name || 'N/A'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold text-slate-700">{tr("Date de l'opération", 'تاريخ العملية')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-12 bg-white border-slate-200 rounded-xl justify-start text-left font-medium shadow-sm hover:bg-slate-50 transition-all",
                        !sendForm.date && "text-slate-500"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 text-indigo-600" />
                      {sendForm.date ? (
                        sendForm.date.toLocaleDateString(uiDateLocale, { year: 'numeric', month: 'long', day: '2-digit' })
                      ) : (
                        <span>{tr('Choisir une date', 'اختر تاريخًا')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={sendForm.date || undefined}
                      onSelect={(date) => date && setSendForm({ ...sendForm, date })}
                      initialFocus
                      className="bg-white p-4"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-bold text-slate-700">{tr('Choisir fournisseur', 'اختر المورّد')}</Label>
              <Select 
                value={sendForm.supplierId} 
                onValueChange={(value) => setSendForm({...sendForm, supplierId: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 flex-row">
                  <SelectValue placeholder={tr('Choisir le fournisseur...', 'اختر المورّد...')} />
                </SelectTrigger>
              <SelectContent>
                {safeSuppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 border-b pb-2">{tr('Bouteilles à envoyer', 'القنينات المراد إرسالها')}</h4>
              <div className="grid gap-4">
                {bottleTypes
                  .filter(bt => !bt.name.includes('Détendeur'))
                  .map((bt) => {
                    const emptyStock = getEmptyStock(bt.id);
                    const defectiveStock = getDefectiveStock(bt.id);
                    const bottleIndex = sendForm.bottles.findIndex(b => b.bottleTypeId === bt.id);
                    const bottleEntry = sendForm.bottles[bottleIndex];
                    
                    return (
                      <div key={bt.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all group">
                        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                              <Package className="w-5 h-5 text-slate-900" />
                            </div>
                            <span className="font-bold text-slate-900 text-lg">{bt.name}</span>
                          </div>

                          <div className="flex flex-1 gap-6">
                            <div className="flex-1 space-y-2">
                              <Label className="text-xs font-bold text-slate-500 uppercase">
                                {tr('Vide', 'فارغ')} <span className="text-blue-600 font-black">({tr('Disponible', 'متاح')}: {emptyStock})</span>
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={(bottleEntry?.emptyQuantity || 0) === 0 ? '' : (bottleEntry?.emptyQuantity || 0)}
                                placeholder={tr('Entrez quantité', 'أدخل الكمية')}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const newBottles = [...sendForm.bottles];
                                  if (bottleIndex !== -1) {
                                    newBottles[bottleIndex] = {
                                      ...newBottles[bottleIndex],
                                      emptyQuantity: value
                                    };
                                  } else {
                                    newBottles.push({
                                      bottleTypeId: bt.id,
                                      emptyQuantity: value,
                                      defectiveQuantity: 0
                                    });
                                  }
                                  setSendForm({...sendForm, bottles: newBottles});
                                }}
                                className="h-11 border-none bg-white rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20"
                              />
                            </div>
                            <div className="flex-1 space-y-2">
                              <Label className="text-xs font-bold text-slate-500 uppercase">
                                {tr('Défectueux', 'معيب')} <span className="text-rose-600 font-black">({tr('Disponible', 'متاح')}: {defectiveStock})</span>
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={(bottleEntry?.defectiveQuantity || 0) === 0 ? '' : (bottleEntry?.defectiveQuantity || 0)}
                                placeholder={tr('Entrez quantité', 'أدخل الكمية')}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const newBottles = [...sendForm.bottles];
                                  if (bottleIndex !== -1) {
                                    newBottles[bottleIndex] = {
                                      ...newBottles[bottleIndex],
                                      defectiveQuantity: value
                                    };
                                  } else {
                                    newBottles.push({
                                      bottleTypeId: bt.id,
                                      emptyQuantity: 0,
                                      defectiveQuantity: value
                                    });
                                  }
                                  setSendForm({...sendForm, bottles: newBottles});
                                }}
                                className="h-11 border-none bg-white rounded-xl font-bold focus:ring-2 focus:ring-rose-500/20"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              onClick={handleSendToFactory}
              className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-slate-200"
            >
              {tr("Confirmer l'envoi", 'تأكيد الإرسال')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowSendForm(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('Autorisation', 'تفويض')}</DialogTitle>
            <DialogDescription>{tr('Entrer le code pour activer le règlement de dette', 'أدخل الرمز لتفعيل تسوية الدين')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{tr('Code', 'الرمز')}</Label>
            <Input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="**********" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCodeDialog(false)}>{tr('Annuler', 'إلغاء')}</Button>
            <Button onClick={confirmUnlockSettlement}>{tr('Valider', 'تأكيد')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black">
                    {editingSupplier ? tr('Modifier le Fournisseur', 'تعديل المورّد') : tr('Nouveau Fournisseur', 'مورّد جديد')}
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-4">
              <Label className="text-sm font-bold text-slate-700">{tr('Nom du Fournisseur', 'اسم المورّد')}</Label>
              <Input 
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder={tr('Entrez le nom du fournisseur...', 'أدخل اسم المورّد...')}
                className="h-12 border-slate-200 bg-slate-50 rounded-xl"
              />
            </div>
            <div className="space-y-4">
              <Label className="text-sm font-bold text-slate-700">{tr('Compte Banque Fournisseur', 'حساب بنك المورّد')}</Label>
              <Input
                value={newSupplierBankAccount}
                onChange={(e) => setNewSupplierBankAccount(e.target.value)}
                placeholder={tr('Ex: Caisse Banque ZAGORA', 'مثال: Caisse Banque ZAGORA')}
                className="h-12 border-slate-200 bg-slate-50 rounded-xl"
              />
            </div>
          </div>
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddSupplier(false);
                setEditingSupplier(null);
                setNewSupplierName('');
                setNewSupplierBankAccount('');
              }}
              className="flex-1 h-12 rounded-xl font-bold"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button 
              onClick={handleAddSupplier}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl font-bold"
            >
              {editingSupplier ? tr('Enregistrer', 'حفظ') : tr('Ajouter', 'إضافة')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Management Dialog */}
      <Dialog open={showSupplierManagement} onOpenChange={setShowSupplierManagement}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div className="">
                    <DialogTitle className="text-2xl font-black">{tr('Gestion Fournisseurs', 'إدارة المورّدين')}</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1">
                      {tr('Suivi des fournisseurs, transactions et dettes par type', 'متابعة المورّدين والمعاملات والديون حسب النوع')}
                    </DialogDescription>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowAddSupplier(true)}
                  className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {tr('Nouveau Fournisseur', 'مورّد جديد')}
                </Button>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                {tr('Filtre Achats par Date', 'فلتر المشتريات حسب التاريخ')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">{tr('Du', 'من')}</Label>
                  <Input type="date" value={supplierFilterFromDate} onChange={(e) => setSupplierFilterFromDate(e.target.value)} className="h-10 bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">{tr('Au', 'إلى')}</Label>
                  <Input type="date" value={supplierFilterToDate} onChange={(e) => setSupplierFilterToDate(e.target.value)} className="h-10 bg-white" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full"
                    onClick={() => {
                      setSupplierFilterFromDate('');
                      setSupplierFilterToDate('');
                    }}
                  >
                    {tr('Réinitialiser', 'إعادة التعيين')}
                  </Button>
                </div>
              </div>
            </div>
            {safeSuppliers.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Users className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{tr('Aucun fournisseur', 'لا يوجد مورّد')}</h3>
                <p className="text-slate-500 max-w-xs mx-auto mb-6">{tr('Commencez par ajouter votre premier fournisseur pour suivre ses transactions.', 'ابدأ بإضافة أول مورّد لمتابعة معاملاته.')}</p>
                <Button 
                  onClick={() => setShowAddSupplier(true)}
                  className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-8"
                >
                  {tr('Ajouter un fournisseur', 'إضافة مورّد')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {safeSuppliers.map(supplier => (
                  <div key={supplier.id} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-slate-200">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900">{supplier.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-slate-100">
                              {supplier.transactionCount} {tr('Transaction(s)', 'معاملة')}
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-slate-100">
                              {factoryOperations.filter(op => op.supplierId === supplier.id && op.blReference).length} {tr('BL(s)', 'BL')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {tr('Compte Banque', 'الحساب البنكي')}: {String((supplier as any).bankAccountName || tr('Non défini', 'غير محدد'))}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                              {tr('Total achat', 'إجمالي المشتريات')}: {Number(supplierPurchaseStats[supplier.id]?.total || 0).toFixed(3)}
                            </span>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">
                              {tr('Factures', 'الفواتير')}: {Number(supplierPurchaseStats[supplier.id]?.count || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedSupplierForInvoice(supplier.id);
                            setShowInvoiceForm(true);
                          }}
                          className="rounded-xl border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {tr('Créer Facture', 'إنشاء فاتورة')}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onClickReglerDette(supplier.id)}
                          className="rounded-xl border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {tr('Régler Dette', 'تسوية الدين')}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditSupplier(supplier)}
                          className="rounded-xl border-slate-200 hover:bg-white hover:text-blue-600 hover:border-blue-200"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          {tr('Modifier', 'تعديل')}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const code = window.prompt(tr("Veuillez entrer le code de sécurité pour supprimer ce fournisseur :", "يرجى إدخال رمز الأمان لحذف هذا المورد :"));
                            if (code === "SFTGAZ25") {
                              deleteSupplier(supplier.id);
                            } else if (code !== null) {
                              alert(tr("Code incorrect. Suppression annulée.", "رمز غير صحيح. تم إلغاء الحذف."));
                            }
                          }}
                          className="rounded-xl border-slate-200 hover:bg-white hover:text-rose-600 hover:border-rose-200"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {tr('Supprimer', 'حذف')}
                        </Button>
                      </div>
                    </div>

                    {/* BL References List */}
                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{tr('Derniers Bons de Livraison (BL)', 'آخر سندات التسليم (BL)')}</p>
                      <div className="flex flex-wrap gap-2">
                        {factoryOperations
                          .filter(op => op.supplierId === supplier.id && op.blReference)
                          .slice(-5)
                          .reverse()
                          .map(op => (
                            <Badge key={op.id} variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold py-1 px-3 rounded-lg">
                              {op.blReference}
                            </Badge>
                          ))}
                        {factoryOperations.filter(op => op.supplierId === supplier.id && op.blReference).length === 0 && (
                          <span className="text-xs text-slate-400 italic">{tr('Aucun BL enregistré', 'لا يوجد BL مسجّل')}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bottleTypes
                        .filter(bt => !bt.name.includes('Détendeur'))
                        .map(bt => {
                          const debt = supplier.debts?.find(d => d.bottleTypeId === bt.id) || { emptyDebt: 0, defectiveDebt: 0 };
                          return (
                            <div key={bt.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">{bt.name}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">{tr('Dette Vides', 'دين الفارغ')}:</span>
                                  <Badge className={`${debt.emptyDebt > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'} border-none font-black`}>
                                    {debt.emptyDebt}
                                  </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">{tr('Défectueux', 'معيب')}:</span>
                                  <Badge className={`${debt.defectiveDebt > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'} border-none font-black`}>
                                    {debt.defectiveDebt}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowSupplierManagement(false)}
              className="h-12 px-8 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              {tr('Fermer', 'إغلاق')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Creation Dialog */}
      <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">{tr('Créer une Facture (Groupement BL)', 'إنشاء فاتورة (تجميع BL)')}</DialogTitle>
                  <DialogDescription className="text-indigo-100 mt-1">
                    {tr('Sélectionnez les bons de livraison à regrouper dans cette facture', 'اختر سندات التسليم لتجميعها في هذه الفاتورة')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              <Label className="text-sm font-bold text-slate-700">{tr('Fournisseur', 'المورّد')}</Label>
              <Input 
                value={safeSuppliers.find(s => s.id === selectedSupplierForInvoice)?.name || ''} 
                disabled 
                className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-bold text-slate-700">{tr('Sélectionner les BL', 'اختيار BL')}</Label>
                <span className="text-xs font-bold text-indigo-600">{selectedBLsForInvoice.length} {tr('sélectionné(s)', 'محدد')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {factoryOperations
                  .filter(op => op.supplierId === selectedSupplierForInvoice && op.blReference)
                  .map(op => {
                    const isSelected = selectedBLsForInvoice.includes(op.blReference!);
                    const isAlreadyInvoiced = invoices.some(inv => inv.blReferences.includes(op.blReference!));
                    
                    return (
                      <button
                        key={op.id}
                        disabled={isAlreadyInvoiced}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedBLsForInvoice(prev => prev.filter(ref => ref !== op.blReference));
                          } else {
                            setSelectedBLsForInvoice(prev => [...prev, op.blReference!]);
                          }
                        }}
                        className={`flex flex-col p-4 rounded-2xl border-2 transition-all text-left ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100' 
                            : isAlreadyInvoiced
                              ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                              : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-slate-900">{op.blReference}</span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                          {isAlreadyInvoiced && <Badge variant="outline" className="text-[8px] py-0">{tr('Facturé', 'مفوترة')}</Badge>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {new Date(op.date).toLocaleDateString(uiDateLocale)}
                        </span>
                        <span className="text-xs font-bold text-slate-600 mt-1">
                          {(op.sentBottles || []).reduce((s, b) => s + b.quantity, 0)} {tr('bouteilles', 'قنينة')}
                        </span>
                      </button>
                    );
                  })}
              </div>
              {factoryOperations.filter(op => op.supplierId === selectedSupplierForInvoice && op.blReference).length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">{tr('Aucun BL disponible pour ce fournisseur', 'لا يوجد BL متاح لهذا المورّد')}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="text-[10px] font-bold text-indigo-600 uppercase">{tr('Groupée / Non', 'مجمعة / غير مجمعة')}</p>
                <p className="text-lg font-black text-indigo-900 mt-1">
                  {selectedBLsForInvoice.length > 1 ? tr('Groupée', 'مجمعة') : tr('Non groupée', 'غير مجمعة')}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-[10px] font-bold text-emerald-600 uppercase">{tr('Total (Env/Rec)', 'الإجمالي (مرسل/مستلم)')}</p>
                <p className="text-lg font-black text-emerald-900 mt-1">
                  {selectedInvoiceTotals.totalSentSelected} / {selectedInvoiceTotals.totalReceivedSelected}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase">{tr('Total', 'الإجمالي')}</p>
                <p className="text-lg font-black text-slate-900 mt-1">
                  {Number(selectedInvoiceTotals.totalAmountSelected || 0).toFixed(3)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">{tr('Paiement (Banque)', 'الدفع (بنكي)')}</Label>
              <Select value={invoicePaymentMethod} onValueChange={(value: 'banque' | 'none') => setInvoicePaymentMethod(value)}>
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50">
                  <SelectValue placeholder={tr('Choisir...', 'اختر...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr('Non payé', 'غير مدفوع')}</SelectItem>
                  <SelectItem value="banque">{tr('Banque', 'بنكي')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">{tr('Compte Fournisseur', 'حساب المورّد')}</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {String((selectedInvoiceSupplier as any)?.bankAccountName || tr('Non défini', 'غير محدد'))}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => selectedSupplierForInvoice && handleSetSupplierBankAccount(selectedSupplierForInvoice)}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  {tr('Ajouter / Modifier compte', 'إضافة / تعديل الحساب')}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowInvoiceForm(false);
                setSelectedBLsForInvoice([]);
                setInvoicePaymentMethod('none');
              }}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button 
              onClick={handleCreateInvoice}
              disabled={selectedBLsForInvoice.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {tr('Créer la facture', 'إنشاء الفاتورة')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={showEditInvoice} onOpenChange={setShowEditInvoice}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Edit2 className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">{tr('Modifier la facture', 'تعديل الفاتورة')}</DialogTitle>
                  <DialogDescription className="text-indigo-100 mt-1">
                    {tr('Modifier les détails de la facture', 'تعديل تفاصيل الفاتورة')} {editingInvoice?.id}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('N° Facture', 'رقم الفاتورة')}</Label>
              <Input 
                value={editingInvoice?.id || ''} 
                onChange={(e) => setEditingInvoice(prev => prev ? {...prev, id: e.target.value} : null)}
                className="h-12 border-slate-200 rounded-xl bg-slate-50"
              />
            </div>
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('Date', 'التاريخ')}</Label>
              <Input 
                type="date"
                value={editingInvoice?.date ? editingInvoice.date.slice(0, 10) : ''} 
                onChange={(e) => setEditingInvoice(prev => prev ? {...prev, date: new Date(e.target.value).toISOString()} : null)}
                className="h-12 border-slate-200 rounded-xl bg-slate-50"
              />
            </div>
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('Statut', 'الحالة')}</Label>
              <Select 
                value={editingInvoice?.status} 
                onValueChange={(value: 'pending' | 'paid') => setEditingInvoice(prev => prev ? {...prev, status: value} : null)}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50">
                  <SelectValue placeholder={tr('Choisir le statut...', 'اختر الحالة...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{tr('En attente', 'قيد الانتظار')}</SelectItem>
                  <SelectItem value="paid">{tr('Payée', 'مدفوعة')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowEditInvoice(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button 
              onClick={handleUpdateInvoice}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200"
            >
              {tr('Enregistrer', 'حفظ')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settlement Form Dialog */}
      <Dialog open={showSettlementForm} onOpenChange={setShowSettlementForm}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-emerald-600 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">{tr('Nouveau règlement de dette', 'تسوية دين جديدة')}</DialogTitle>
                  <DialogDescription className="text-emerald-100 mt-1">
                    {tr('Enregistrer la réception de bouteilles du fournisseur pour régler les dettes', 'تسجيل استلام قنينات من المورّد لتسوية الديون')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('Fournisseur', 'المورّد')}</Label>
              <Select 
                value={settlementForm.supplierId} 
                onValueChange={(value) => setSettlementForm({...settlementForm, supplierId: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left flex-row">
                  <SelectValue placeholder={tr('Choisir le fournisseur...', 'اختر المورّد...')} />
                </SelectTrigger>
              <SelectContent className="text-left">
                {safeSuppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('Type de bouteille', 'نوع القنينة')}</Label>
              <Select 
                value={settlementForm.bottleTypeId} 
                onValueChange={(value) => setSettlementForm({...settlementForm, bottleTypeId: value})}
                disabled={!settlementForm.supplierId}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left flex-row">
                  <SelectValue placeholder={settlementForm.supplierId ? tr("Choisir le type...", "اختر النوع...") : tr("Sélectionnez d'abord un fournisseur", "اختر مورّدًا أولاً")} />
                </SelectTrigger>
                <SelectContent className="text-left">
                  {bottleTypes
                    .filter(bt => !bt.name.includes('Détendeur'))
                    .map(bt => {
                      const debt = settlementForm.supplierId ? getSupplierDebt(settlementForm.supplierId, bt.id) : null;
                      const debtText = debt 
                        ? (language === 'ar' ? ` (فارغ: ${debt.emptyDebt}، معيب: ${debt.defectiveDebt})` : ` (Vides: ${debt.emptyDebt}, Déf: ${debt.defectiveDebt})`) 
                        : '';
                      return (
                        <SelectItem key={bt.id} value={bt.id}>
                          {bt.name}{debtText}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              {settlementForm.bottleTypeId && settlementForm.supplierId && (
                <div className="flex gap-4 mt-2">
                  {(() => {
                    const debt = getSupplierDebt(settlementForm.supplierId, settlementForm.bottleTypeId);
                    return (
                      <>
                        <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{tr('Dette Vides', 'دين الفارغ')}</p>
                          <p className={`text-lg font-black ${debt.emptyDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {debt.emptyDebt}
                          </p>
                        </div>
                        <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{tr('Dette Défectueux', 'دين المعيب')}</p>
                          <p className={`text-lg font-black ${debt.defectiveDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {debt.defectiveDebt}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('Type de règlement', 'نوع التسوية')}</Label>
              <Select 
                value={settlementForm.type} 
                onValueChange={(value: 'empty' | 'defective') => setSettlementForm({...settlementForm, type: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-left">
                  <SelectItem value="empty">{tr('Règlement vide', 'تسوية الفارغ')}</SelectItem>
                  <SelectItem value="defective">{tr('Règlement défectueux', 'تسوية المعيب')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('Quantité reçue', 'الكمية المستلمة')}</Label>
              <Input
                type="number"
                min="1"
                value={settlementForm.quantity}
                onChange={(e) => setSettlementForm({...settlementForm, quantity: parseInt(e.target.value) || 0})}
                className="h-12 border-slate-200 bg-slate-50 rounded-xl text-left font-black text-lg focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr('Notes (Optionnel)', 'ملاحظات (اختياري)')}</Label>
              <Input
                value={settlementForm.description}
                onChange={(e) => setSettlementForm({...settlementForm, description: e.target.value})}
                placeholder={tr('Ex: Compensation en espèces, échange...', 'مثال: تعويض نقدي، تبديل...')}
                className="h-12 border-slate-200 bg-slate-50 rounded-xl text-left focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowSettlementForm(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button 
              onClick={handleDebtSettlement}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 flex-1"
            >
              {tr('Enregistrer le règlement', 'حفظ التسوية')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Form Dialog */}
      <Dialog open={showReturnForm} onOpenChange={setShowReturnForm}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <ArrowLeft className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">{tr("Réception de l'Usine", 'استلام من المصنع')}</DialogTitle>
                  <DialogDescription className="text-slate-400 mt-1">
                    {tr('Enregistrer le retour du camion et la réception des bouteilles pleines', 'تسجيل عودة الشاحنة واستلام القنينات المملوءة')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-8 bg-white max-h-[70vh] overflow-y-auto">
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">{tr("Choisir l'opération (Chargement en attente)", 'اختر العملية (تحميل قيد الانتظار)')}</Label>
              <Select 
                value={returnForm.operationId} 
                onValueChange={(value) => setReturnForm({...returnForm, operationId: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left">
                  <SelectValue placeholder={tr("Choisir l'opération...", "اختر العملية...")} />
                </SelectTrigger>
                <SelectContent className="text-left">
                  {pendingOperations.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>
                      {op.driverName} - {new Date(op.date).toLocaleDateString(uiDateLocale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="space-y-4 mt-4">
                <Label className="text-sm font-bold text-slate-700">{tr('Date de réception', 'تاريخ الاستلام')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-12 bg-white border-slate-200 rounded-xl justify-start text-left font-medium shadow-sm hover:bg-slate-50 transition-all",
                        !returnForm.date && "text-slate-500"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 text-emerald-600" />
                      {returnForm.date ? (
                        returnForm.date.toLocaleDateString(uiDateLocale, { year: 'numeric', month: 'long', day: '2-digit' })
                      ) : (
                        <span>{tr('Choisir une date', 'اختر تاريخًا')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={returnForm.date || undefined}
                      onSelect={(date) => date && setReturnForm({ ...returnForm, date })}
                      initialFocus
                      className="bg-white p-4"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {returnForm.operationId && (
              <div className="space-y-6">
                <h4 className="text-lg font-black text-slate-900 text-left border-b pb-2">{tr('Bouteilles reçues', 'القنينات المستلمة')}</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {bottleTypes.map((bt, index) => {
                    const receivedEntry = returnForm.receivedBottles[index] || { bottleTypeId: bt.id, quantity: 0 };
                    const effectivePrice = localPurchasePrices[bt.id] ?? (bt.purchasePrice ?? bt.unitPrice ?? 0);
                    return (
                    <div key={bt.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                          <Package className="w-5 h-5 text-slate-900" />
                        </div>
                        <span className="font-bold text-slate-900">{bt.name}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="text-left space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">{tr('Quantité', 'الكمية')}</Label>
                          <Input
                            type="number"
                            value={receivedEntry.quantity === 0 ? '' : receivedEntry.quantity}
                            placeholder={tr('Entrez quantité', 'أدخل الكمية')}
                            onChange={(e) => {
                              const newBottles = [...returnForm.receivedBottles];
                              const nextQuantity = parseInt(e.target.value) || 0;
                              if (newBottles[index]) {
                                newBottles[index] = { ...newBottles[index], quantity: nextQuantity };
                              } else {
                                newBottles[index] = { bottleTypeId: bt.id, quantity: nextQuantity };
                              }
                              setReturnForm({...returnForm, receivedBottles: newBottles});
                            }}
                            className="h-11 border-none bg-white rounded-xl text-left font-bold focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        <div className="text-left space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">{tr("Prix d'achat", 'سعر الشراء')}</Label>
                          <Input
                            type="number"
                            value={String(effectivePrice)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setLocalPurchasePrices(prev => ({ ...prev, [bt.id]: val }));
                              updateBottleType(bt.id, { purchasePrice: val });
                            }}
                            className="h-11 border-none bg-white rounded-xl text-left font-bold focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <div className="text-xs text-slate-500">
                            {tr('Montant', 'المبلغ')}: {Number(effectivePrice * (receivedEntry.quantity || 0)).toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowReturnForm(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              {tr('Annuler', 'إلغاء')}
            </Button>
            <Button 
              onClick={handleReturnFromFactory}
              className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-slate-200"
            >
              {tr('Confirmer la réception', 'تأكيد الاستلام')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Section */}
      <motion.div variants={itemVariants} layout>
        <Card id="factory-history" className="border-none shadow-xl shadow-slate-200/50 bg-white/90 backdrop-blur-md rounded-3xl overflow-hidden text-left">
          <CardHeader className="border-b border-slate-100 p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-xl font-bold text-slate-900">{tr('Journal des opérations', 'سجل العمليات')}</CardTitle>
                  <p className="text-slate-400 text-xs mt-1">{tr('Historique des chargements et des règlements de dettes', 'سجل عمليات التحميل وتسويات الديون')}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                  <Button
                    variant={historyTab === 'operations' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setHistoryTab('operations')}
                    className={`h-9 px-4 rounded-lg font-bold transition-all ${historyTab === 'operations' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    {tr('Chargements', 'التحميلات')}
                  </Button>
                  <Button
                    variant={historyTab === 'settlements' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setHistoryTab('settlements')}
                    className={`h-9 px-4 rounded-lg font-bold transition-all ${historyTab === 'settlements' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    {tr('Règlements', 'التسويات')}
                  </Button>
                  <Button
                    variant={historyTab === 'invoices' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setHistoryTab('invoices')}
                    className={`h-9 px-4 rounded-lg font-bold transition-all ${historyTab === 'invoices' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    {tr('Factures', 'الفواتير')}
                  </Button>
                </div>
                <div className="relative group min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <Input 
                    value={commandCenterSearch}
                    onChange={(e) => setCommandCenterSearch(e.target.value)}
                    placeholder={
                      historyTab === 'invoices'
                        ? tr('Rechercher facture, fournisseur ou BL...', 'ابحث عن فاتورة أو مورد أو BL...')
                        : historyTab === 'settlements'
                        ? tr('Rechercher règlement, fournisseur...', 'ابحث عن تسوية أو مورد...')
                        : tr('Rechercher une opération...', 'ابحث عن عملية...')
                    }
                    className="pl-10 h-11 bg-slate-50 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-slate-900/10 transition-all text-left"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={exportOperationsPDF}
                  className="h-11 px-5 border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {tr('Exporter PDF', 'تصدير PDF')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {historyTab === 'operations' ? (
                <Table className="reports-table-ultra">
                  <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                    <TableHead className="py-3 font-bold text-slate-600 text-left px-4">{tr('Date', 'التاريخ')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Date réception', 'تاريخ الاستلام')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Chauffeur', 'السائق')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Statut', 'الحالة')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Envoyé', 'مرسل')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Reçu', 'مستلم')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Prix', 'السعر')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Montant', 'المبلغ')}</TableHead>
                    <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Dette/Diff', 'الدين/الفرق')}</TableHead>
                    <TableHead className="py-3 text-right font-bold text-slate-600 px-4">{tr('Actions', 'إجراءات')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredFactoryOperations.length > 0 ? (
                      filteredFactoryOperations.map((operation, idx) => {
                        const totalSentOp = (operation.sentBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
                        const totalReceivedOp = (operation.receivedBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
                        const isPending = (operation.receivedBottles || []).length === 0;
                        const totalAmountOp = (operation.receivedBottles || []).reduce((s, b) => {
                          const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
                          const price = bt?.purchasePrice || 0;
                          return s + price * b.quantity;
                        }, 0);
                        const uniquePrices = Array.from(new Set((operation.receivedBottles || []).map(b => {
                          const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
                          return bt?.purchasePrice || 0;
                        })).values()).filter(p => p > 0);

                        return (
                          <motion.tr
                            key={operation.id}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            layout
                            transition={{ 
                              delay: idx * 0.03,
                              layout: { duration: 0.2 }
                            }}
                            whileHover={{ x: 5, backgroundColor: "rgba(248, 250, 252, 1)" }}
                            className="group hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 border-l-2 border-transparent hover:border-indigo-500"
                          >
                            <TableCell className="py-3 font-medium text-slate-600 text-left px-4">
                              {new Date(operation.date).toLocaleDateString(uiDateLocale, { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              {operation.receivedDate
                                ? new Date(operation.receivedDate).toLocaleDateString(uiDateLocale)
                                : <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              <div className="flex items-center gap-3 justify-start">
                                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                                  {(operation.driverName || tr('N/A', 'غير متاح')).charAt(0)}
                                </div>
                                <span className="font-bold text-slate-700">{operation.driverName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              <Badge 
                                variant={isPending ? "outline" : "default"}
                                className={`rounded-lg px-3 py-1 font-bold text-[10px] border-none shadow-sm ${
                                  isPending 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {isPending ? tr('En attente', 'قيد الانتظار') : tr('Terminée', 'مكتملة')}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                {totalSentOp} {tr('bouteilles', 'قنينات')}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                                {totalReceivedOp} {tr('bouteilles', 'قنينات')}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              {uniquePrices.length === 1 ? Number(uniquePrices[0]).toFixed(3) : <span className="text-slate-400">{tr('Multiple', 'متعدد')}</span>}
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700">
                                {Number(totalAmountOp).toFixed(3)}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 text-left">
                              {operation.debtChange !== 0 ? (
                                <div className={`flex items-center gap-1 font-bold justify-start ${
                                  operation.debtChange > 0 ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                  {operation.debtChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {Math.abs(operation.debtChange)}
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-right px-4">
                              <div className="flex items-center gap-2 justify-end">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleDownloadPDF(operation)}
                                  className="w-9 h-9 rounded-xl hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => deleteFactoryOperation(operation.id)}
                                  className="w-9 h-9 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
                                  title={tr("Supprimer l'opération", 'حذف العملية')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-900 hover:bg-white shadow-sm rounded-lg transition-all">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
                                    <div className="bg-slate-900 p-8 text-white text-left">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <div className="p-3 bg-white/10 rounded-2xl">
                                            <Package className="w-6 h-6 text-white" />
                                          </div>
                                          <div className="text-left">
                                            <DialogTitle className="text-2xl font-black">{tr("Détails de l'opération", 'تفاصيل العملية')}</DialogTitle>
                                            <p className="text-slate-400 text-sm mt-1">
                                              {operation.driverName} • {new Date(operation.date).toLocaleDateString(uiDateLocale)}
                                              {(operation.receivedBottles || []).length > 0 && operation.receivedDate ? 
                                                (language === 'ar' ? ` • استلام: ${new Date(operation.receivedDate).toLocaleDateString(uiDateLocale)}` : ` • Réception: ${new Date(operation.receivedDate).toLocaleDateString(uiDateLocale)}`) 
                                                : ''
                                              }
                                            </p>
                                          </div>
                                        </div>
                                        <Badge className={isPending ? "bg-amber-500" : "bg-emerald-500"}>
                                          {isPending ? tr('En attente', 'قيد الانتظار') : tr('Terminée', 'مكتملة')}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="p-8 grid md:grid-cols-2 gap-8 bg-white">
                                      <div className="space-y-4 text-left">
                                        <h4 className="font-black text-slate-900 flex items-center gap-2">
                                          <TrendingUp className="w-4 h-4 text-blue-600" />
                                          {tr('Quantités envoyées', 'الكميات المرسلة')}
                                        </h4>
                                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                          {(operation.sentBottles || []).map((bottle, bidx) => {
                                            const bt = bottleTypes.find(b => b.id === bottle.bottleTypeId);
                                            return (
                                              <div key={bidx} className="flex justify-between items-center text-sm">
                                                <span className="font-bold text-slate-600">{bt?.name}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-400">({bottle.status === 'empty' ? tr('Vide', 'فارغ') : tr('Défectueux', 'معيب')})</span>
                                                  <span className="font-black text-slate-900">{bottle.quantity}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div className="space-y-4 text-left">
                                        <h4 className="font-black text-slate-900 flex items-center gap-2">
                                          <TrendingDown className="w-4 h-4 text-emerald-600" />
                                          {tr('Quantités reçues', 'الكميات المستلمة')}
                                        </h4>
                                        {(operation.receivedBottles || []).length > 0 ? (
                                          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                            {(operation.receivedBottles || []).map((bottle, bidx) => {
                                              const bt = bottleTypes.find(b => b.id === bottle.bottleTypeId);
                                              return (
                                                <div key={bidx} className="flex justify-between items-center text-sm">
                                                  <span className="font-bold text-slate-600">{bt?.name}</span>
                                                  <span className="font-black text-slate-900">{bottle.quantity}</span>
                                                </div>
                                              );
                                            })}
                                            {operation.debtChange !== 0 && (
                                              <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                                                <span className="font-bold text-slate-900">{tr('Différence de dette', 'فرق الدين')}</span>
                                                <span className={`font-black ${operation.debtChange > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                  {operation.debtChange > 0 ? '+' : ''}{operation.debtChange} {tr('bouteilles', 'قنينات')}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="bg-amber-50 rounded-2xl p-8 text-center">
                                            <Truck className="w-8 h-8 text-amber-400 mx-auto mb-2 animate-bounce" />
                                            <p className="text-amber-700 font-bold text-sm">{tr("En attente du retour de l'usine", 'في انتظار الرجوع من المصنع')}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                      <Button variant="outline" onClick={() => handleDownloadPDF(operation)} className="rounded-xl font-bold border-slate-200">
                                        <Download className="w-4 h-4 mr-2" />
                                        {tr('Télécharger le rapport', 'تنزيل التقرير')}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDownloadPDF(operation)}
                                  className="h-9 w-9 text-slate-400 hover:text-slate-900 hover:bg-white shadow-sm rounded-lg transition-all"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-slate-50 rounded-full">
                              <History className="w-8 h-8 text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-medium">{tr('Aucune opération enregistrée pour le moment', 'لا توجد أي عملية مسجلة حاليًا')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
              ) : historyTab === 'settlements' ? (
                <Table className="reports-table-ultra">
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                      <TableHead className="py-3 font-bold text-slate-600 text-left px-4">{tr('Date', 'التاريخ')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Fournisseur', 'المورّد')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Type de bouteille', 'نوع القنينة')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Type de règlement', 'نوع التسوية')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Quantité', 'الكمية')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left px-4">{tr('Description', 'الوصف')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredDebtSettlements.length > 0 ? (
                        filteredDebtSettlements.map((settlement, idx) => {
                          const supplier = safeSuppliers.find(s => s.id === settlement.supplierId);
                          const bottleType = bottleTypes.find(bt => bt.id === settlement.bottleTypeId);

                          return (
                            <motion.tr
                              key={settlement.id}
                              variants={itemVariants}
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              layout
                              transition={{ 
                                delay: idx * 0.03,
                                layout: { duration: 0.2 }
                              }}
                              whileHover={{ x: 5, backgroundColor: "rgba(248, 250, 252, 1)" }}
                              className="group hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 border-l-2 border-transparent hover:border-emerald-500"
                            >
                              <TableCell className="py-3 px-4 font-medium text-slate-600 text-left">
                                {new Date(settlement.date).toLocaleDateString(uiDateLocale, { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </TableCell>
                              <TableCell className="py-3 font-black text-slate-900 text-left">
                                {supplier?.name || tr('Inconnu', 'غير معروف')}
                              </TableCell>
                              <TableCell className="py-3 font-bold text-slate-700 text-left">
                                {bottleType?.name || tr('Inconnu', 'غير معروف')}
                              </TableCell>
                              <TableCell className="py-3 text-left">
                                <Badge variant="outline" className={`font-bold px-3 py-1 rounded-lg border-none shadow-sm ${
                                  settlement.type === 'empty' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {settlement.type === 'empty' ? tr('Vide', 'فارغ') : tr('Défectueux', 'معيب')}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 font-black text-emerald-600 text-left">
                                {settlement.quantity} btl
                              </TableCell>
                              <TableCell className="py-3 px-4 text-slate-500 text-sm italic text-left">
                                {settlement.description}
                              </TableCell>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-slate-50 rounded-full">
                                <History className="w-8 h-8 text-slate-200" />
                              </div>
                              <p className="text-slate-400 font-medium">{tr('Aucun règlement enregistré', 'لا توجد أي تسوية مسجلة')}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              ) : (
                <Table className="reports-table-ultra">
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                      <TableHead className="py-3 font-bold text-slate-600 text-left px-4">{tr('N° Facture', 'رقم الفاتورة')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Date', 'التاريخ')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Fournisseur', 'المورّد')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Groupée / Non', 'مجمعة / غير مجمعة')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('BLs', 'BL')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Total (Env/Rec)', 'الإجمالي (مرسل/مستلم)')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Montant', 'المبلغ')}</TableHead>
                      <TableHead className="py-3 font-bold text-slate-600 text-left">{tr('Statut', 'الحالة')}</TableHead>
                      <TableHead className="py-3 text-right font-bold text-slate-600 px-4">{tr('Actions', 'إجراءات')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredInvoiceRows.length > 0 ? (
                        filteredInvoiceRows.map((invoice, idx) => {
                          const supplier = safeSuppliers.find(s => s.id === invoice.supplierId);
                          const isGrouped = invoice.source === 'invoice' && (invoice.blReferences?.length || 0) > 1;
                          const isSingle = invoice.source === 'single-bl';
                          const operation = isSingle
                            ? factoryOperations.find(op => String(op.id) === String((invoice as any).operationId))
                            : null;
                          return (
                            <motion.tr
                              key={invoice.id}
                              variants={itemVariants}
                              initial="hidden"
                              animate="visible"
                              className={`group hover:bg-slate-50/80 transition-colors border-b border-slate-50 ${isSingle ? 'border-l-2 border-amber-300' : 'border-l-2 border-transparent'}`}
                            >
                              <TableCell className="py-3 font-black text-slate-900 px-4">{invoice.id}</TableCell>
                              <TableCell className="py-3 text-slate-600">
                                {new Date(invoice.date).toLocaleDateString(uiDateLocale)}
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="font-bold text-slate-700">{supplier?.name || tr('N/A', 'غير متاح')}</span>
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge className={isSingle ? 'bg-amber-100 text-amber-700' : isGrouped ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}>
                                  {isSingle ? tr('Non groupée', 'غير مجمعة') : isGrouped ? tr('Groupée', 'مجمعة') : tr('BL unique', 'BL مفرد')}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex flex-wrap gap-1">
                                  {invoice.blReferences.map(ref => (
                                    <Badge key={ref} variant="outline" className="text-[10px] bg-white">
                                      {ref}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">{invoice.totalSent} {tr('envoyées', 'مرسلة')}</span>
                                  <span className="text-xs text-slate-500">{invoice.totalReceived} {tr('reçues', 'مستلمة')}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">{Number(invoice.totalAmount || 0).toFixed(3)}</span>
                                  <span className="text-xs text-slate-500">{tr('Montant', 'المبلغ')}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge className={invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                  {invoice.status === 'paid' ? tr('Payée', 'مدفوعة') : tr('En attente', 'قيد الانتظار')}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 text-right px-4">
                                <div className="flex items-center gap-2 justify-end">
                                  {invoice.source === 'invoice' ? (
                                    <>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDownloadInvoicePDF(invoice)}
                                        className="w-9 h-9 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all"
                                        title={tr('Télécharger PDF', 'تنزيل PDF')}
                                      >
                                        <Download className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleToggleInvoicePaid(invoice)}
                                        title={invoice.status === 'paid' ? tr('Marquer comme en attente', 'وضع كقيد الانتظار') : tr('Marquer comme payée', 'وضع كمدفوعة')}
                                        className={`w-9 h-9 rounded-xl transition-all ${invoice.status === 'paid' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                      >
                                        {invoice.status === 'paid' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => {
                                          setEditingInvoice(invoice);
                                          setOriginalInvoiceId(invoice.id);
                                          setShowEditInvoice(true);
                                        }}
                                        className="w-9 h-9 rounded-xl text-blue-600 hover:bg-blue-50 transition-all"
                                        title={tr('Modifier la facture', 'تعديل الفاتورة')}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => deleteInvoice(invoice.id)}
                                        className="w-9 h-9 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
                                        title={tr('Supprimer la facture', 'حذف الفاتورة')}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => operation && handleDownloadPDF(operation)}
                                        className="w-9 h-9 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all"
                                        title={tr('Télécharger BL', 'تنزيل BL')}
                                      >
                                        <Download className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => operation && openInvoiceFromOperation(operation)}
                                        className="w-9 h-9 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-all"
                                        title={tr('Créer facture', 'إنشاء فاتورة')}
                                      >
                                        <FileText className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-slate-50 rounded-full">
                                <History className="w-8 h-8 text-slate-200" />
                              </div>
                              <p className="text-slate-400 font-medium">{tr('Aucune facture générée', 'لا توجد أي فاتورة')}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {tr('Total', 'الإجمالي')} {historyTab === 'operations' ? tr('opérations', 'عمليات') : historyTab === 'settlements' ? tr('règlements', 'تسويات') : tr('factures', 'فواتير')}: {historyTab === 'operations' ? factoryOperations.length : historyTab === 'settlements' ? debtSettlements.length : invoiceRows.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled className="h-9 rounded-lg border-slate-200 text-slate-400">{tr('Précédent', 'السابق')}</Button>
              <Button variant="outline" size="sm" className="h-9 w-9 rounded-lg bg-slate-900 text-white border-none shadow-md">1</Button>
              <Button variant="outline" size="sm" disabled className="h-9 rounded-lg border-slate-200 text-slate-400">{tr('Suivant', 'التالي')}</Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Factory;
