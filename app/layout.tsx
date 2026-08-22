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

const SITE_TITLE = "Nexo — El asistente inteligente para tu negocio";
const SITE_DESCRIPTION =
  "Nexo aprende cómo funciona tu negocio y te ayuda a atender clientes, responder consultas, gestionar reservas y centralizar tu información desde un solo lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — Nexo",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "asistente IA para negocios",
    "automatización para empresas",
    "atención al cliente con IA",
    "gestión de reservas",
    "asistente virtual para empresas",
    "IA para pymes",
  ],
  publisher: "Kodexa",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "Nexo",
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
