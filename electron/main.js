const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .container {
          text-align: center;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .text {
          color: #f59e0b;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: 1px;
        }
        .spinner {
          margin-top: 30px;
          width: 40px;
          height: 40px;
          margin-left: auto;
          margin-right: auto;
          border: 3px solid #f59e0b;
          border-top: 3px solid transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🍽️</div>
        <div class="text">DineBoss</div>
        <div class="spinner"></div>
      </div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'DineBoss',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow) {
      splashWindow.destroy();
      splashWindow = null;
    }
  });

  // Allow all internal navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = [
      'http://localhost:3000',
      'https://dineboss.vercel.app'
    ];
    const isAllowed = allowed.some(base => url.startsWith(base));
    if (!isAllowed) {
      event.preventDefault();
    }
  });

  // Load the login page directly
  const url = isDev
    ? 'http://localhost:3000/login'
    : 'https://dineboss.vercel.app/login';
  mainWindow.loadURL(url);

  // Auto start with Windows (for production)
  if (!isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      name: 'DineBoss',
    });
  }

  // Open DevTools only in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createSplashWindow();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ─── PRINT HANDLER (INVISIBLE WINDOW) ────────────────────────────────────
ipcMain.handle('print-to-printer', async (event, { htmlContent, printerName, paperSize }) => {
  // Create invisible print window
  const printWindow = new BrowserWindow({
    show: false,
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const widthMicrons = paperSize === '50mm' ? 50000
    : paperSize === '58mm' ? 58000 : 80000;

  // Load the receipt HTML directly
  await printWindow.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
  );

  return new Promise((resolve) => {
    printWindow.webContents.print(
      {
        silent: true,
        printBackground: true,
        deviceName: printerName || '',
        margins: { marginType: 'none' },
        pageSize: {
          width: widthMicrons,
          height: 2970000,
        },
        scaleFactor: 100,
      },
      (success, errorType) => {
        printWindow.close();
        resolve({ success, error: errorType || null });
      }
    );
  });
});

// ─── GET PRINTERS WITH AUTO-DETECTION ────────────────────────────────────
ipcMain.handle('get-printers', async () => {
  const printers = await mainWindow.webContents.getPrintersAsync();

  return printers.map(printer => {
    // Auto-detect paper size from printer name/model
    const name = (printer.name + ' ' + (printer.description || '')).toLowerCase();

    let detectedSize = '80mm'; // default
    let printerType = 'unknown';

    // Common thermal printer model detection
    if (name.includes('58') || name.includes('xp-58') ||
        name.includes('rp58') || name.includes('ct-s300')) {
      detectedSize = '58mm';
      printerType = 'thermal';
    } else if (name.includes('50') || name.includes('xp-50')) {
      detectedSize = '50mm';
      printerType = 'thermal';
    } else if (name.includes('80') || name.includes('xp-80') ||
               name.includes('tm-t88') || name.includes('tm-t82') ||
               name.includes('rp80') || name.includes('ct-s800') ||
               name.includes('epson') || name.includes('star') ||
               name.includes('bixolon') || name.includes('citizen') ||
               name.includes('posiflex') || name.includes('rongta') ||
               name.includes('sewoo') || name.includes('thermal')) {
      detectedSize = '80mm';
      printerType = 'thermal';
    } else if (name.includes('pdf') || name.includes('microsoft') ||
               name.includes('onenote') || name.includes('fax')) {
      printerType = 'virtual';
    } else if (name.includes('hp') || name.includes('canon') ||
               name.includes('xerox') || name.includes('ricoh')) {
      printerType = 'inkjet_laser';
    }

    // Status detection
    // status codes: 0=ready, 1=paused, 2=error, 4=pending, 8=offline
    const statusMap = {
      0: 'ready',
      1: 'paused',
      2: 'error',
      4: 'pending',
      8: 'offline',
    };
    const statusText = statusMap[printer.status] || 'unknown';
    const isOnline = printer.status === 0;

    return {
      name: printer.name,
      description: printer.description || '',
      isDefault: printer.isDefault,
      status: statusText,
      isOnline,
      detectedPaperSize: detectedSize,
      printerType,
      displayName: `${printer.name}${printer.isDefault ? ' (Default)' : ''}`,
    };
  });
});

// Auto-refresh printer status every 30 seconds and push to renderer
setInterval(async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const printers = await mainWindow.webContents.getPrintersAsync();
    mainWindow.webContents.send('printers-updated', printers.map(p => ({
      name: p.name,
      isOnline: p.status === 0,
      status: p.status === 0 ? 'ready' : 'offline',
    })));
  }
}, 30000);

// ─── GENERATE PDF AND OPEN WITH DEFAULT VIEWER ──────────────────────────────
ipcMain.handle('print-to-pdf', async (event, { htmlContent, paperSize }) => {
  // Create invisible window to render and generate PDF
  const printWindow = new BrowserWindow({
    show: false,
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Convert paper size to microns
  const widthMicrons = paperSize === '50mm' ? 50000
    : paperSize === '58mm' ? 58000 : 80000;

  // Load the receipt HTML
  await printWindow.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
  );

  // Wait for content to fully render
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Generate PDF with thermal paper dimensions
    const pdfBuffer = await printWindow.webContents.printToPDF({
      pageSize: { width: widthMicrons, height: 2970000 },
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    printWindow.close();

    // Save PDF to temp folder
    const os = require('os');
    const fs = require('fs');
    const tempPath = path.join(os.tmpdir(), `dineboss-bill-${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, pdfBuffer);

    // Try silent print first, fallback to opening PDF
    const { shell, app: electronApp } = require('electron');
    const { exec } = require('child_process');

    // Attempt silent print with SumatraPDF if available, otherwise just open
    exec(`SumatraPDF -print-to-default -silent "${tempPath}"`, (err) => {
      if (err) {
        // SumatraPDF not available — open PDF for manual print
        shell.openPath(tempPath);
      }
    });

    return { success: true, pdfPath: tempPath };
  } catch (error) {
    printWindow.close();
    return { success: false, error: error.message };
  }
});
