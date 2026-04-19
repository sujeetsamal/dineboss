import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata = {
  title: "DineBoss",
  description: "Multi-tenant restaurant order management platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary transition-colors duration-200">
        {/* Hidden print area for Electron printing */}
        <div
          id="electron-print-area"
          style={{
            display: 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '80mm',
            zIndex: 99999,
            background: 'white',
            color: 'black',
          }}
        />
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            },
          }}
        />
      </body>
    </html>
  );
}
