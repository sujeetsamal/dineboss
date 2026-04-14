import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
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
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#161009",
              color: "#FFF5E4",
              border: "1px solid #2E1F0A",
            },
          }}
        />
      </body>
    </html>
  );
}
