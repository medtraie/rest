import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { Users, Plus, Pencil, Trash2, History, Download, Search, RotateCcw, Sparkles, LayoutGrid, Rows3, ArrowUpRight, Activity, Wallet, Clock3, Command, Flame, CircleDashed, Crosshair, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useT } from '@/contexts/LanguageContext';

const Clients = () => {
  const { clients, addClient, updateClient, deleteClient, supplyOrders = [] } = useApp();
  const t = useT();
  const tc = (key: string, fallback: string) => t(`clients.pdf.${key}`, fallback);
  const tu = (key: string, fallback: string) => t(`clients.ui.${key}`, fallback);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [editClientName, setEditClientName] = useState('');
  
  // History states
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [clientsView, setClientsView] = useState<'cards' | 'compact'>('cards');
  const [clientsSort, setClientsSort] = useState<'activity' | 'name'>('activity');
  const [clientsSearch, setClientsSearch] = useState('');
  const [clientsPulse, setClientsPulse] = useState<'all' | 'active' | 'inactive'>('all');

  const clientOrders = useMemo(() => {
    if (!selectedClient) return [];
    return supplyOrders.filter(order => order.clientId === selectedClient.id)
      .filter(order => {
        const orderDate = new Date(order.date);
        const start = dateFilter.start ? new Date(dateFilter.start) : null;
        const end = dateFilter.end ? new Date(dateFilter.end) : null;
        
        if (start && orderDate < start) return false;
        if (end) {
          const endOfDay = new Date(end);
          endOfDay.setHours(23, 59, 59, 999);
          if (orderDate > endOfDay) return false;
        }
        
        if (searchTerm && !order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedClient, supplyOrders, dateFilter, searchTerm]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  const selectAllOrders = () => {
    if (selectedOrders.length === clientOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(clientOrders.map(o => o.id));
    }
  };

  const generateInvoicePDF = () => {
    try {
      if (selectedOrders.length === 0 || !selectedClient) {
        toast.error(tu('toast.selectAtLeastOneBs', 'Veuillez sélectionner au moins un bon de sortie'));
        return;
      }

      const ordersToInvoice = clientOrders.filter(o => selectedOrders.includes(o.id));
      if (ordersToInvoice.length === 0) {
        toast.error(tu('toast.noBsFound', 'Aucun bon de sortie trouvé'));
        return;
      }

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(41, 128, 185);
      doc.text(tc('title', 'FACTURE - BONS DE SORTIE'), 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`${tc('date', 'Date')}: ${format(new Date(), 'dd/MM/yyyy')}`, 105, 30, { align: 'center' });

      // Client Info
      doc.setDrawColor(200);
      doc.line(20, 40, 190, 40);
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`${tc('client', 'Client')}: ${selectedClient.name}`, 20, 50);
      doc.text(`${tc('ordersCount', 'Nombre de bons')}: ${ordersToInvoice.length}`, 20, 60);

      // Table
      const tableData = ordersToInvoice.map(order => [
        order.date ? format(new Date(order.date), 'dd/MM/yyyy') : 'N/A',
        order.orderNumber || 'N/A',
        (order.items || []).map((item: any) => `${item.fullQuantity || 0} x ${item.bottleTypeName || 'Produit'}`).join('\n'),
        `${(order.total || 0).toFixed(2)} DH`
      ]);

      (autoTable as any)(doc, {
        startY: 70,
        head: [[tc('date', 'Date'), tc('bsNumber', 'N° B.S'), tc('products', 'Produits'), tc('amount', 'Montant')]],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          3: { halign: 'right' }
        }
      });

      // Get final Y position safely
      const finalY = (doc as any).lastAutoTable?.cursor?.y || 150;
      const totalAmount = ordersToInvoice.reduce((sum, o) => sum + (o.total || 0), 0);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${tc('grandTotal', 'TOTAL GÉNÉRAL')}: ${totalAmount.toFixed(2)} DH`, 190, finalY + 10, { align: 'right' });

      doc.save(`Facture_${selectedClient.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
      toast.success(tu('toast.invoiceGenerated', 'Facture générée avec succès'));
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      toast.error(tu('toast.pdfError', 'Erreur lors de la génération du PDF. Veuillez réessayer.'));
    }
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      toast.error(tu('toast.enterClientName', 'Veuillez entrer un nom de client'));
      return;
    }
    addClient({ name: newClientName.trim() });
    toast.success(tu('toast.clientAdded', 'Client ajouté avec succès'));
    setAddDialogOpen(false);
    setNewClientName('');
  };

  const handleEditClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !editClientName.trim()) {
      toast.error(tu('toast.enterClientName', 'Veuillez entrer un nom de client'));
      return;
    }
    updateClient(selectedClient.id, { name: editClientName.trim() });
    toast.success(tu('toast.clientUpdated', 'Client modifié avec succès'));
    setEditDialogOpen(false);
    setSelectedClient(null);
    setEditClientName('');
  };

  const handleDeleteClient = () => {
    if (!selectedClient) return;
    deleteClient(selectedClient.id);
    toast.success(tu('toast.clientDeleted', 'Client supprimé avec succès'));
    setDeleteDialogOpen(false);
    setSelectedClient(null);
  };

  const openEditDialog = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    setEditClientName(client.name);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const resetFilters = () => {
    setDateFilter({ start: '', end: '' });
    setSearchTerm('');
    setSelectedOrders([]);
  };

  const openHistoryDialog = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    resetFilters();
    setHistoryDialogOpen(true);
  };
  useEffect(() => {
    const handleClientsShortcuts = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === '1') {
        event.preventDefault();
        setClientsView('cards');
      } else if (key === '2') {
        event.preventDefault();
        setClientsView('compact');
      } else if (key === 'k') {
        event.preventDefault();
        document.getElementById('clients-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleClientsShortcuts);
    return () => window.removeEventListener('keydown', handleClientsShortcuts);
  }, []);

  const clientInsights = useMemo(() => {
    return clients.map((client) => {
      const orders = supplyOrders.filter((order) => order.clientId === client.id);
      const orderCount = orders.length;
      const totalAmount = orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const lastOrderDate = orders.length > 0
        ? orders.reduce((latest, order) => {
            const current = new Date(order.date).getTime();
            return current > latest ? current : latest;
          }, 0)
        : 0;
      return {
        client,
        orderCount,
        totalAmount,
        lastOrderDate
      };
    });
  }, [clients, supplyOrders]);

  const filteredClients = useMemo(() => {
    const query = clientsSearch.trim().toLowerCase();
    const filtered = clientInsights.filter(({ client }) => {
      if (!query) return true;
      return client.name.toLowerCase().includes(query);
    }).filter((item) => {
      if (clientsPulse === 'all') return true;
      if (clientsPulse === 'active') return item.orderCount > 0;
      return item.orderCount === 0;
    });
    return filtered.sort((a, b) => {
      if (clientsSort === 'name') return a.client.name.localeCompare(b.client.name);
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      return b.lastOrderDate - a.lastOrderDate;
    });
  }, [clientInsights, clientsSearch, clientsSort, clientsPulse]);

  const activeClients = clientInsights.filter((item) => item.orderCount > 0).length;
  const totalClientRevenue = clientInsights.reduce((sum, item) => sum + item.totalAmount, 0);
  const topClient = clientInsights.slice().sort((a, b) => b.orderCount - a.orderCount)[0];
  const clientRadar = clientInsights
    .slice()
    .sort((a, b) => {
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      return b.totalAmount - a.totalAmount;
    })
    .slice(0, 4);

  return (
    <div className="app-page-shell p-6 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-800 text-white p-6 md:p-8">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 left-10 w-52 h-52 bg-fuchsia-300/20 rounded-full blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              {tu('hero.studio', 'Clients Studio')}
            </div>
            <h1 className="app-page-title text-3xl md:text-4xl font-black mt-3">{tu('hero.title', 'Gestion des Clients')}</h1>
            <p className="app-page-subtitle text-indigo-100 mt-1">
              {tu('hero.subtitle', 'Une vue pilotée pour gérer vos clients, leur activité et leurs bons de sortie.')}
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg shadow-indigo-900/30">
                <Plus className="w-4 h-4 mr-2" />
                {tu('actions.addClient', 'Ajouter un client')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tu('dialog.addTitle', 'Ajouter un client')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div>
                  <Label htmlFor="clientName">{tu('form.clientName', 'Nom du client')}</Label>
                  <Input
                    id="clientName"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder={tu('form.clientNamePlaceholder', 'Ex: Restaurant Al Amal')}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">{tu('actions.add', 'Ajouter')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-none shadow-lg shadow-indigo-100/60 bg-white/95">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{tu('stats.totalClients', 'Total Clients')}</p>
                <p className="text-2xl font-black text-slate-900">{clients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg shadow-emerald-100/70 bg-white/95">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{tu('stats.activeClients', 'Clients Actifs')}</p>
                <p className="text-2xl font-black text-emerald-700">{activeClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg shadow-amber-100/70 bg-white/95">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{tu('stats.globalVolume', 'Volume Global')}</p>
                <p className="text-2xl font-black text-amber-700">{totalClientRevenue.toFixed(0)} DH</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg shadow-violet-100/70 bg-white/95">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
                <Clock3 className="w-5 h-5 text-violet-600" />
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{tu('stats.topClient', 'Top Client')}</p>
                <p className="text-sm font-bold text-violet-700 truncate max-w-[170px]">
                  {topClient ? topClient.client.name : tu('common.none', 'Aucun')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/95 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Command className="w-5 h-5" />
                {tu('commandDeck.title', 'Clients Command Deck')}
              </CardTitle>
              <p className="text-indigo-100 text-sm mt-1">{tu('commandDeck.subtitle', 'Pilotage rapide des segments clients avec accès direct aux profils.')}</p>
            </div>
            <div className="text-xs text-indigo-100 bg-white/10 border border-white/20 rounded-lg px-3 py-2 inline-flex items-center gap-2 w-fit">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {tu('commandDeck.shortcuts', 'Alt+1 Cards · Alt+2 Compact · Alt+K Search')}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 p-3">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">{tu('filters.pulse', 'Pulse Filter')}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={clientsPulse === 'all' ? 'default' : 'outline'} onClick={() => setClientsPulse('all')}>
                {tu('filters.all', 'Tous')}
              </Button>
              <Button size="sm" variant={clientsPulse === 'active' ? 'default' : 'outline'} onClick={() => setClientsPulse('active')}>
                <Flame className="w-4 h-4 mr-1.5" />
                {tu('filters.active', 'Actifs')}
              </Button>
              <Button size="sm" variant={clientsPulse === 'inactive' ? 'default' : 'outline'} onClick={() => setClientsPulse('inactive')}>
                <CircleDashed className="w-4 h-4 mr-1.5" />
                {tu('filters.inactive', 'Inactifs')}
              </Button>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {tu('filters.currentDisplay', 'Affichage actuel')}: {filteredClients.length} {tu('filters.clientWord', 'client')}{filteredClients.length > 1 ? 's' : ''}.
            </div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
            <div className="text-xs uppercase tracking-wider font-semibold text-indigo-700 mb-2">{tu('radar.title', 'Radar')}</div>
            <div className="space-y-2">
              {clientRadar.map(({ client, orderCount }) => (
                <button
                  key={client.id}
                  type="button"
                  className="w-full text-left rounded-lg bg-white border border-indigo-100 px-3 py-2 hover:border-indigo-300 transition-colors"
                  onClick={() => openHistoryDialog(client)}
                >
                  <div className="text-sm font-semibold text-slate-900 truncate">{client.name}</div>
                  <div className="text-xs text-indigo-600">{orderCount} {tu('common.ordersShort', 'bons')}</div>
                </button>
              ))}
              {clientRadar.length === 0 && (
                <div className="text-xs text-indigo-700">{tu('empty.noClientToDisplay', 'Aucun client à afficher.')}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl shadow-slate-200/60 bg-white/95 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-5">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <CardTitle>{tu('sections.clientList', 'Liste des clients')}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="clients-search-input"
                  value={clientsSearch}
                  onChange={(e) => setClientsSearch(e.target.value)}
                  placeholder={tu('filters.searchClientPlaceholder', 'Rechercher un client...')}
                  className="pl-9 w-[250px] bg-slate-50 border-slate-200"
                />
              </div>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <Button size="sm" variant={clientsPulse === 'all' ? 'secondary' : 'ghost'} className={clientsPulse === 'all' ? 'bg-white shadow-sm' : ''} onClick={() => setClientsPulse('all')}>
                  {tu('filters.all', 'Tous')}
                </Button>
                <Button size="sm" variant={clientsPulse === 'active' ? 'secondary' : 'ghost'} className={clientsPulse === 'active' ? 'bg-white shadow-sm text-emerald-700' : ''} onClick={() => setClientsPulse('active')}>
                  {tu('filters.active', 'Actifs')}
                </Button>
                <Button size="sm" variant={clientsPulse === 'inactive' ? 'secondary' : 'ghost'} className={clientsPulse === 'inactive' ? 'bg-white shadow-sm text-slate-700' : ''} onClick={() => setClientsPulse('inactive')}>
                  {tu('filters.inactive', 'Inactifs')}
                </Button>
              </div>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <Button size="sm" variant={clientsSort === 'activity' ? 'secondary' : 'ghost'} className={clientsSort === 'activity' ? 'bg-white shadow-sm' : ''} onClick={() => setClientsSort('activity')}>
                  {tu('filters.activity', 'Activité')}
                </Button>
                <Button size="sm" variant={clientsSort === 'name' ? 'secondary' : 'ghost'} className={clientsSort === 'name' ? 'bg-white shadow-sm' : ''} onClick={() => setClientsSort('name')}>
                  {tu('filters.name', 'Nom')}
                </Button>
              </div>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <Button size="sm" variant={clientsView === 'cards' ? 'secondary' : 'ghost'} className={clientsView === 'cards' ? 'bg-white shadow-sm' : ''} onClick={() => setClientsView('cards')}>
                  <LayoutGrid className="w-4 h-4 mr-1.5" />
                  {tu('views.cards', 'Cards')}
                </Button>
                <Button size="sm" variant={clientsView === 'compact' ? 'secondary' : 'ghost'} className={clientsView === 'compact' ? 'bg-white shadow-sm' : ''} onClick={() => setClientsView('compact')}>
                  <Rows3 className="w-4 h-4 mr-1.5" />
                  {tu('views.compact', 'Compact')}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">{tu('empty.noClientRegistered', 'Aucun client enregistré')}</h3>
              <p className="text-muted-foreground mb-4">
                {tu('empty.addFirstClient', 'Commencez par ajouter votre premier client')}
              </p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">{tu('empty.noClientFound', 'Aucun client trouvé')}</h3>
              <p className="text-muted-foreground">{tu('empty.tryAnotherSearch', 'Essayez un autre terme de recherche')}</p>
            </div>
          ) : clientsView === 'cards' ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredClients.map(({ client, orderCount, totalAmount, lastOrderDate }, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: index * 0.02 }}
                  className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <Users className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{client.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {orderCount} {tu('common.orders', 'Bons')} · {totalAmount.toFixed(2)} DH
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700">
                      {orderCount > 0 ? tu('status.active', 'Actif') : tu('status.new', 'Nouveau')}
                    </Badge>
                  </div>
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                    {tu('common.lastActivity', 'Dernière activité')}: {lastOrderDate ? format(new Date(lastOrderDate), 'dd/MM/yyyy HH:mm') : tu('common.noneFemale', 'Aucune')}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${Math.min(100, orderCount * 10)}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => openHistoryDialog(client)}
                      title={tu('actions.ordersHistoryTitle', 'Historique des Bons')}
                    >
                      <History className="w-4 h-4 mr-1.5" />
                      {tu('actions.history', 'Historique')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(client)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => openDeleteDialog(client)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-indigo-600 hover:bg-indigo-50"
                      onClick={() => openHistoryDialog(client)}
                    >
                      <Crosshair className="w-4 h-4 mr-1" />
                      {tu('actions.focus', 'Focus')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-indigo-600 hover:bg-indigo-50"
                      onClick={() => openHistoryDialog(client)}
                    >
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                      {tu('actions.open', 'Ouvrir')}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClients.map(({ client, orderCount, totalAmount, lastOrderDate }) => (
                <div key={client.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl hover:bg-muted/40 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {orderCount} {tu('common.orders', 'Bons')} · {totalAmount.toFixed(2)} DH · {tu('common.last', 'Dernier')}: {lastOrderDate ? format(new Date(lastOrderDate), 'dd/MM/yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => openHistoryDialog(client)}
                    >
                      <History className="w-4 h-4 mr-2" />
                      {tu('actions.history', 'Historique')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(client)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => openDeleteDialog(client)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between w-full pr-8">
              <DialogTitle>
                {tu('historyDialog.title', 'Historique des Bons de Sortie')} - {selectedClient?.name}
              </DialogTitle>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  generateInvoicePDF();
                }} 
                disabled={selectedOrders.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                {tu('actions.generateInvoicePdf', 'Générer Facture PDF')} ({selectedOrders.length})
                {selectedOrders.length > 0 && (
                  <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-xs">
                    {clientOrders
                      .filter(o => selectedOrders.includes(o.id))
                      .reduce((sum, o) => sum + (o.total || 0), 0)
                      .toFixed(2)} DH
                  </span>
                )}
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="block">{tu('historyDialog.searchByBs', 'Rechercher par N° B.S')}</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={tu('historyDialog.bsPlaceholder', 'N° Bon de sortie...')}
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="block">{tu('historyDialog.startDate', 'Date Début')}</Label>
                <Input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="block">{tu('historyDialog.endDate', 'Date Fin')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFilter.end}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={resetFilters}
                    title={tu('actions.resetFilters', 'Réinitialiser les filtres')}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={clientOrders.length > 0 && selectedOrders.length === clientOrders.length}
                        onCheckedChange={selectAllOrders}
                      />
                    </TableHead>
                    <TableHead>{tu('table.date', 'Date')}</TableHead>
                    <TableHead>{tu('table.bsNumber', 'N° B.S')}</TableHead>
                    <TableHead>{tu('table.products', 'Produits')}</TableHead>
                    <TableHead className="text-right">{tu('table.amount', 'Montant')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {tu('empty.noBsForClient', 'Aucun bon de sortie trouvé pour ce client')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Checkbox 
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
                        <TableCell>{format(new Date(order.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="font-mono">{order.orderNumber}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {order.items.map((item, idx) => (
                              <div key={idx}>
                                {item.fullQuantity} x {item.bottleTypeName}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">{order.total.toFixed(2)} DH</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tu('dialog.editTitle', 'Modifier le client')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditClient} className="space-y-4">
            <div>
              <Label htmlFor="editClientName">{tu('form.clientName', 'Nom du client')}</Label>
              <Input
                id="editClientName"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                placeholder={tu('form.clientNameSimplePlaceholder', 'Nom du client')}
                required
              />
            </div>
            <Button type="submit" className="w-full">{tu('actions.save', 'Enregistrer')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tu('deleteDialog.title', 'Êtes-vous sûr de vouloir supprimer ce client ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tu('deleteDialog.description', 'Cette action ne peut pas être annulée. Cela supprimera définitivement le client.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tu('actions.cancel', 'Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-red-600 hover:bg-red-700">
              {tu('actions.delete', 'Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;
