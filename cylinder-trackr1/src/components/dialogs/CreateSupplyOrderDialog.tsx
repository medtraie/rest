export const CreateSupplyOrderDialog: React.FC<CreateSupplyOrderDialogProps> = ({
  // ... existing code ...
}) => {
  const { bottleTypes, clients, addSupplyOrder, updateInventory, supplyOrders, addTransaction } = useApp();
  // ... existing code ...

  const handleSubmit = () => {
    // ... existing code ...

    // Create supply order
    addSupplyOrder({
      orderNumber,
      date: new Date().toISOString(),
      driverId,
      driverName,
      clientId: selectedClientId,
      clientName: selectedClient?.name || '',
      items: items.filter(item => item.emptyQuantity > 0 || item.fullQuantity > 0),
      subtotal,
      tax,
      total,
    });

    // سجل معاملات السحب (B.S) للـ Inventaire — allogaz
    items.forEach(item => {
      const now = new Date().toISOString();
      // Pleins خارج المخزن (توزيع على السائق)
      if (item.fullQuantity > 0) {
        addTransaction({
          date: now,
          type: 'supply',
          section: 'inventaire',
          source: 'allogaz',
          orderNumber,
          driverId,
          driverName,
          clientId: selectedClientId,
          clientName: selectedClient?.name || '',
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: item.fullQuantity, status: 'unsold' } // غير مباعة بعد
          ],
          description: `B.S ${orderNumber}: sortie ${item.fullQuantity} ${item.bottleTypeName} (pleins)`
        });
      }
      // Vides خارج المخزن (إذا كان لديك إخراج vides في B.S)
      if (item.emptyQuantity > 0) {
        addTransaction({
          date: now,
          type: 'supply',
          section: 'inventaire',
          source: 'allogaz',
          orderNumber,
          driverId,
          driverName,
          clientId: selectedClientId,
          clientName: selectedClient?.name || '',
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: item.emptyQuantity, status: 'empty' }
          ],
          description: `B.S ${orderNumber}: sortie ${item.emptyQuantity} ${item.bottleTypeName} (vides)`
        });
      }
    });

    toast({
      title: "Bon de Sortie créé",
      description: `B.S N° ${orderNumber} a été créé avec succès pour ${driverName}`,
    });

    // ... existing code ...
  };

  // ... existing code ...
};