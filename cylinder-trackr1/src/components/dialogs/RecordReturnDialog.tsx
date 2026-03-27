export const RecordReturnDialog = ({ open, onOpenChange, supplyOrder }: RecordReturnDialogProps) => {
  const { addReturnOrder, addExpense, updateBottleType, bottleTypes, updateDriver, drivers, addForeignBottle, updateEmptyBottlesStock, addDefectiveBottle, addRevenue, addTransaction } = useApp();
  // ... existing code ...

  const handleSubmit = () => {
    // ... existing code ...

    addReturnOrder(
      supplyOrder.id,
      items,
      ventesSummary.totalVentes,
      totalExpenses,
      totalRC,
      netSales,
      supplyOrder.driverId ?? '',
      driverDebtChange,
      0,
      ''
    );

    // سجل معاملات الرجوع (B.D) للـ Inventaire — supply-return
    items.forEach(item => {
      const now = new Date().toISOString();

      // Pleins revenus (غير مباعة)
      if ((item.returnedFullQuantity || 0) > 0) {
        addTransaction({
          date: now,
          type: 'return',
          section: 'inventaire',
          source: 'supply-return',
          orderNumber: supplyOrder.orderNumber,
          driverId: supplyOrder.driverId,
          driverName: supplyOrder.driverName,
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: item.returnedFullQuantity, status: 'unsold' }
          ],
          description: `B.D retour ${supplyOrder.orderNumber}: ${item.returnedFullQuantity} ${item.bottleTypeName} (pleins revenus)`
        });
      }

      // Vides revenus
      if ((item.returnedEmptyQuantity || 0) > 0) {
        addTransaction({
          date: now,
          type: 'return',
          section: 'inventaire',
          source: 'supply-return',
          orderNumber: supplyOrder.orderNumber,
          driverId: supplyOrder.driverId,
          driverName: supplyOrder.driverName,
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: item.returnedEmptyQuantity, status: 'empty' }
          ],
          description: `B.D retour ${supplyOrder.orderNumber}: ${item.returnedEmptyQuantity} ${item.bottleTypeName} (vides revenus)`
        });
      }

      // Ventes = VIDES + CONSIGNE
      const soldQty = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
      if (soldQty > 0) {
        addTransaction({
          date: now,
          type: 'return',
          section: 'inventaire',
          source: 'supply-return',
          orderNumber: supplyOrder.orderNumber,
          driverId: supplyOrder.driverId,
          driverName: supplyOrder.driverName,
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: soldQty, status: 'sold' }
          ],
          description: `B.D ventes ${supplyOrder.orderNumber}: ${soldQty} ${item.bottleTypeName} (vendus)`
        });
      }

      // Étranger
      if ((item.foreignQuantity || 0) > 0) {
        addTransaction({
          date: now,
          type: 'return',
          section: 'inventaire',
          source: 'supply-return',
          orderNumber: supplyOrder.orderNumber,
          driverId: supplyOrder.driverId,
          driverName: supplyOrder.driverName,
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: item.foreignQuantity, status: 'foreign' }
          ],
          description: `B.D étranger ${supplyOrder.orderNumber}: ${item.foreignQuantity} ${item.bottleTypeName}`
        });
      }

      // Défectueux
      if ((item.defectiveQuantity || 0) > 0) {
        addTransaction({
          date: now,
          type: 'return',
          section: 'inventaire',
          source: 'supply-return',
          orderNumber: supplyOrder.orderNumber,
          driverId: supplyOrder.driverId,
          driverName: supplyOrder.driverName,
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: item.defectiveQuantity, status: 'defective' }
          ],
          description: `B.D défectueux ${supplyOrder.orderNumber}: ${item.defectiveQuantity} ${item.bottleTypeName}`
        });
      }

      // Perdu (R.C)
      if ((item.lostQuantity || 0) > 0) {
        addTransaction({
          date: now,
          type: 'return',
          section: 'inventaire',
          source: 'supply-return',
          orderNumber: supplyOrder.orderNumber,
          driverId: supplyOrder.driverId,
          driverName: supplyOrder.driverName,
          bottleTypes: [
            { bottleTypeId: item.bottleTypeId, quantity: item.lostQuantity, status: 'lost' }
          ],
          description: `B.D perdu ${supplyOrder.orderNumber}: ${item.lostQuantity} ${item.bottleTypeName}`
        });
      }
    });

    // ... existing code ...
  };

  // ... existing code ...
};