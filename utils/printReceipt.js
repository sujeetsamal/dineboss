function getPaperConfig(paperSize) {
  const configs = {
    '50mm': {
      width: '50mm',
      pixelWidth: 189,
      fontSize: '10px',
      headerFontSize: '12px',
      totalFontSize: '13px',
      padding: '2mm',
      lineHeight: '1.3',
      itemNameMaxWidth: '28mm',
    },
    '58mm': {
      width: '58mm',
      pixelWidth: 219,
      fontSize: '11px',
      headerFontSize: '13px',
      totalFontSize: '14px',
      padding: '2mm',
      lineHeight: '1.4',
      itemNameMaxWidth: '34mm',
    },
    '80mm': {
      width: '80mm',
      pixelWidth: 302,
      fontSize: '12px',
      headerFontSize: '14px',
      totalFontSize: '16px',
      padding: '3mm',
      lineHeight: '1.5',
      itemNameMaxWidth: '50mm',
    },
  };
  return configs[paperSize] || configs['80mm'];
}

function buildPrintDocument(contentHTML, config) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=${config.pixelWidth}px">
      <style>
        /* Reset everything */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        html {
          width: ${config.pixelWidth}px;
          margin: 0;
          padding: 0;
        }

        body {
          width: ${config.pixelWidth}px;
          background: #ffffff;
          color: #000000;
          font-family: 'Courier New', Courier, monospace;
          font-size: ${config.fontSize};
          line-height: ${config.lineHeight};
          padding: ${config.padding};
          margin: 0;
          overflow-x: hidden;
        }
        }

        /* Header styles */
        .receipt-header {
          text-align: center;
          margin-bottom: 4px;
        }
        .restaurant-name {
          font-size: ${config.headerFontSize};
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .receipt-subtitle {
          font-size: ${config.fontSize};
          color: #333;
        }

        /* Divider */
        .divider {
          border: none;
          border-top: 1px dashed #000;
          margin: 3px 0;
        }
        .divider-solid {
          border: none;
          border-top: 1px solid #000;
          margin: 3px 0;
        }

        /* Order info */
        .order-info {
          margin: 3px 0;
          font-size: ${config.fontSize};
        }
        .order-info-row {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
        }

        /* Item rows */
        .item-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 2px 0;
          gap: 2mm;
        }
        .item-name {
          flex: 1;
          max-width: ${config.itemNameMaxWidth};
          word-wrap: break-word;
        }
        .item-qty {
          white-space: nowrap;
          text-align: center;
          min-width: 8mm;
        }
        .item-price {
          white-space: nowrap;
          text-align: right;
          min-width: 12mm;
        }

        /* Totals */
        .totals-row {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
          font-size: ${config.fontSize};
        }
        .grand-total-row {
          display: flex;
          justify-content: space-between;
          font-size: ${config.totalFontSize};
          font-weight: bold;
          margin: 3px 0;
        }
        .discount-row {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
        }

        /* Footer */
        .receipt-footer {
          text-align: center;
          margin-top: 6px;
          font-size: ${config.fontSize};
        }

        /* KOT specific */
        .kot-header {
          text-align: center;
          font-size: ${config.headerFontSize};
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 4px;
        }
        .kot-item {
          display: flex;
          justify-content: space-between;
          font-size: ${config.headerFontSize};
          font-weight: bold;
          margin: 3px 0;
        }
        .kot-note {
          font-size: ${config.fontSize};
          font-style: italic;
          color: #333;
          padding-left: 4mm;
        }

        /* Hide everything on screen, only show when printing */
        @media screen {
          body { display: block; }
        }
      </style>
    </head>
    <body>${contentHTML}</body>
    </html>
  `;
}

export async function printReceipt(receiptHTML, paperSize = '80mm') {
  // Check if running inside Electron
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    // Electron: build complete HTML document and send to invisible print window
    const printerName = localStorage.getItem('dineboss_printer_name') || '';
    const size = paperSize || localStorage.getItem('dineboss_paper_size') || '80mm';

    const fullHTML = buildPrintDocument(receiptHTML, getPaperConfig(size));

    const result = await window.electronAPI.printToPrinter(fullHTML, printerName, size);

    if (!result.success) {
      console.error('Silent print failed:', result.error);
      // Only fallback to iframe if silent print fails
      printWithIframe(receiptHTML, size);
    }
    return;
  }
  // Browser fallback
  printWithIframe(receiptHTML, paperSize);
}

function printWithIframe(receiptHTML, paperSize = '80mm') {
  const config = getPaperConfig(paperSize);

  // Show print tips BEFORE opening print dialog
  showPrintTips(paperSize);
  
  // Delay print dialog so toast is visible
  setTimeout(() => {
    const existing = document.getElementById('dineboss-print-frame');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'dineboss-print-frame';
    iframe.style.cssText = `
      position: fixed;
      top: -99999px;
      left: -99999px;
      width: ${config.pixelWidth}px;
      max-width: ${config.pixelWidth}px;
      min-width: ${config.pixelWidth}px;
      height: 1px;
      border: none;
      visibility: hidden;
      overflow: hidden;
    `;
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(buildPrintDocument(receiptHTML, config));
    doc.close();

    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print failed:', e);
      }
      setTimeout(() => {
        if (document.getElementById('dineboss-print-frame')) {
          document.getElementById('dineboss-print-frame').remove();
        }
      }, 2500);
    };
  }, 1500);
}

function showPrintTips(paperSize = '80mm') {
  const toastId = 'dineboss-print-toast-' + Date.now();
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, rgb(31, 41, 55) 0%, rgb(15, 23, 42) 100%);
    color: white;
    font-size: 0.95rem;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1) inset;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    max-width: 600px;
    border: 1px solid rgba(255, 215, 0, 0.3);
    animation: slideUp 0.4s ease-out;
  `;
  
  const message = document.createElement('div');
  message.style.cssText = `
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #ffd700;
  `;
  message.textContent = '📋 PRINT SETTINGS REQUIRED:';
  
  const instructions = document.createElement('div');
  instructions.style.cssText = `
    font-size: 0.9rem;
    color: #e0e0e0;
    line-height: 1.7;
  `;
  instructions.innerHTML = `
    <div>1️⃣ In Paper Size → Select <strong>"Custom"</strong></div>
    <div>2️⃣ Set width to <strong>"${paperSize}"</strong></div>
    <div>3️⃣ Set Scale to <strong>"100%"</strong> or "Actual size"</div>
    <div>4️⃣ Uncheck <strong>"Headers and Footers"</strong></div>
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
  
  toast.appendChild(message);
  toast.appendChild(instructions);
  document.body.appendChild(toast);
  
  // Show for longer so user can read before print dialog opens
  setTimeout(() => {
    if (document.getElementById(toastId)) {
      const el = document.getElementById(toastId);
      el.style.animation = 'slideUp 0.4s ease-out reverse';
      setTimeout(() => {
        if (document.getElementById(toastId)) {
          document.getElementById(toastId).remove();
        }
      }, 400);
    }
  }, 10000);
}

export function buildReceiptHTML(order, settings) {
  // Safe numeric calculations with fallbacks
  const gstPercent = parseFloat(order.gst) || 0;
  const servicePercent = parseFloat(order.serviceCharge) || 0;
  const discountValue = parseFloat(order.discount) || 0;
  
  const subtotal = (order.items || []).reduce((sum, item) =>
    sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)), 0);
  
  const gstAmount = Math.round(subtotal * (gstPercent / 100));
  const serviceAmount = Math.round(subtotal * (servicePercent / 100));
  const discountAmount = order.discountType === '%'
    ? Math.round(subtotal * (discountValue / 100))
    : discountValue;
  const grandTotal = subtotal + gstAmount + serviceAmount - discountAmount;

  const date = order.createdAt
    ? new Date(order.createdAt.seconds * 1000).toLocaleString('en-IN')
    : new Date().toLocaleString('en-IN');

  const itemRows = order.items.map(item => {
    const itemPrice = parseFloat(item.price) || 0;
    const itemQty = parseInt(item.quantity) || 1;
    const itemTotal = Math.round(itemPrice * itemQty);
    return `
    <div class="item-row">
      <span class="item-name">${item.name}</span>
      <span class="item-qty">${itemQty}x</span>
      <span class="item-price">₹${itemTotal}</span>
    </div>
  `;
  }).join('');

  return `
    <div class="receipt-header">
      <div class="restaurant-name">${settings.restaurantName || settings.name || 'Restaurant'}</div>
      ${settings.address ? `<div class="receipt-subtitle">${settings.address}</div>` : ''}
      ${settings.gstNumber ? `<div class="receipt-subtitle">GSTIN: ${settings.gstNumber}</div>` : ''}
    </div>

    <hr class="divider-solid">

    <div class="order-info">
      <div class="order-info-row">
        <span>Order:</span><span>#${order.id}</span>
      </div>
      <div class="order-info-row">
        <span>Table:</span><span>${order.tableName || 'N/A'}</span>
      </div>
      <div class="order-info-row">
        <span>Date:</span><span>${date}</span>
      </div>
      ${order.staffName ? `
      <div class="order-info-row">
        <span>Staff:</span><span>${order.staffName}</span>
      </div>` : ''}
    </div>

    <hr class="divider">

    <div class="order-info-row" style="font-weight:bold;">
      <span>Item</span><span style="text-align:center;min-width:8mm;">Qty</span><span>Amount</span>
    </div>

    <hr class="divider">

    ${itemRows}

    <hr class="divider">

    <div class="totals-row">
      <span>Subtotal</span><span>₹${Math.round(subtotal)}</span>
    </div>
    ${gstPercent > 0 ? `
    <div class="totals-row">
      <span>GST (${gstPercent}%)</span><span>₹${gstAmount}</span>
    </div>` : ''}
    ${servicePercent > 0 ? `
    <div class="totals-row">
      <span>Service (${servicePercent}%)</span><span>₹${serviceAmount}</span>
    </div>` : ''}
    ${discountAmount > 0 ? `
    <div class="discount-row">
      <span>Discount</span><span>-₹${discountAmount}</span>
    </div>` : ''}

    <hr class="divider-solid">

    <div class="grand-total-row">
      <span>TOTAL</span><span>₹${Math.round(grandTotal)}</span>
    </div>

    <div class="totals-row">
      <span>Payment</span><span>${order.paymentMethod || 'Cash'}</span>
    </div>

    <hr class="divider">

    <div class="receipt-footer">
      <div>${settings.thankYouMessage || 'Thank you for dining with us!'}</div>
      <div>Please visit again</div>
    </div>
  `;
}

export function buildKOTHTML(order) {
  const date = order.createdAt
    ? new Date(order.createdAt.seconds * 1000).toLocaleString('en-IN')
    : new Date().toLocaleString('en-IN');

  const itemRows = order.items.map(item => `
    <div class="kot-item">
      <span>${item.name}</span>
      <span>x${item.quantity}</span>
    </div>
    ${item.note ? `<div class="kot-note">Note: ${item.note}</div>` : ''}
  `).join('');

  return `
    <div class="kot-header">— KOT —</div>
    <div class="kot-header">KITCHEN ORDER</div>

    <hr class="divider-solid">

    <div class="order-info-row">
      <span><b>Table: ${order.tableName || 'N/A'}</b></span>
      <span>Order: #${order.id}</span>
    </div>
    <div class="order-info-row">
      <span>${date}</span>
    </div>

    <hr class="divider-solid">

    ${itemRows}

    <hr class="divider">
  `;
}

export function printKOT(order, paperSize = '80mm') {
  const kotHTML = buildKOTHTML(order);
  printReceipt(kotHTML, paperSize);
}
