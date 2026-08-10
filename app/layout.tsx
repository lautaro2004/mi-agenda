import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingProvider } from "@/lib/onboarding-store";
import { WhatsAppProvider } from "@/lib/whatsapp-store";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "Mi Agenda — El asistente operativo de tu negocio";
const SITE_DESCRIPTION =
  "Configurá un asistente de IA que conoce tus servicios, precios, horarios y reglas. Atiende a tus clientes por WhatsApp y gestiona sus reservas automáticamente.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — Mi Agenda",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "asistente de WhatsApp",
    "reservas por WhatsApp",
    "agenda online para negocios",
    "automatizar turnos",
    "asistente IA para negocios",
    "gestión de reservas",
    "agenda para negocios",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "Mi Agenda",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <OnboardingProvider>
              <WhatsAppProvider>
                {children}
                <Toaster />
              </WhatsAppProvider>
            </OnboardingProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
