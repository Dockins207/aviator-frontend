import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster, ToastOptions, DefaultToastOptions } from "react-hot-toast";
import Footer from "@/components/Layout/Footer";
import { Providers } from "@/components/Providers/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aviator Frontend",
  description: "Aviator Chat Application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Custom toast options with explicit typing
  const customToastOptions: DefaultToastOptions = {
    duration: 3000,
    style: {
      background: '#333',
      color: '#fff',
      borderRadius: '8px',
      padding: '12px 20px',
      maxWidth: '400px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontSize: '14px',
      fontWeight: 500,
    },
    success: {
      style: {
        background: '#4CAF50',
        color: 'white',
      },
      icon: '✅',
    },
    error: {
      style: {
        background: '#F44336',
        color: 'white',
      },
      icon: '❌',
    },
    blank: {
      style: {
        background: '#333',
        color: 'white',
      },
    },
    loading: {
      style: {
        background: '#2196F3',
        color: 'white',
      },
      icon: '🔄',
    },
  };

  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster
          position="top-right"
          toastOptions={customToastOptions}
        />
        <Providers>
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
