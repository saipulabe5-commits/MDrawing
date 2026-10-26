const quotation = {
  items: [
    { quantity: 1, unitPrice: 12345.67, totalPrice: 0 }
  ],
  subTotal: 0,
  taxPercentage: 11,
  tax: 0,
  discount: 0,
  grandTotal: 0,
  dpPercentage: 30,
  dpAmount: 0
};

function runLoop() {
  let loops = 0;
  let q = { ...quotation };
  
  while (loops < 10) {
    loops++;
    let itemsChanged = false;
    const newItems = q.items.map(item => {
      const expectedTotal = item.quantity * item.unitPrice;
      if (item.totalPrice !== expectedTotal) {
        itemsChanged = true;
        return { ...item, totalPrice: expectedTotal };
      }
      return item;
    });

    const subTotal = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = q.discount || 0;
    const taxAmount = ((subTotal - discount) * (q.taxPercentage || 0)) / 100;
    const grandTotal = subTotal - discount + taxAmount;
    const dpAmount = (grandTotal * (q.dpPercentage || 0)) / 100;

    let updated = false;
    if (
      itemsChanged ||
      q.subTotal !== subTotal ||
      q.tax !== taxAmount ||
      q.grandTotal !== grandTotal ||
      q.dpAmount !== dpAmount
    ) {
      q = {
        ...q,
        subTotal,
        tax: taxAmount,
        grandTotal,
        dpAmount,
        ...(itemsChanged ? { items: newItems } : {})
      };
      updated = true;
    }
    console.log(`Loop ${loops}: updated=${updated}, tax=${taxAmount}`);
    if (!updated) break;
  }
}
runLoop();
