const { contextBridge, ipcRenderer } = require('electron');

// Expose safe Electron APIs to React app
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running inside Electron
  isElectron: true,

  // Get list of all installed printers with auto-detected paper sizes
  getPrinters: () =>
    ipcRenderer.invoke('get-printers'),

  // Print HTML content to specific printer silently
  printToPrinter: (htmlContent, printerName, paperSize) =>
    ipcRenderer.invoke('print-to-printer', { htmlContent, printerName, paperSize }),

  // Generate PDF and print (or open) with correct thermal paper size
  printToPDF: (htmlContent, paperSize) =>
    ipcRenderer.invoke('print-to-pdf', { htmlContent, paperSize }),

  // Listen to printer updates every 30 seconds
  onPrintersUpdated: (callback) =>
    ipcRenderer.on('printers-updated', (event, printers) => callback(printers)),

  // Remove printer listener
  removePrintersListener: () =>
    ipcRenderer.removeAllListeners('printers-updated'),
});
