import type {
  Metadata,
} from "next";
import "./globals.css";
import NetposAccessGuard from "@/src/components/NetposAccessGuard";

export const metadata: Metadata = {
  title: "Netpos Hospitality",
  description:
    "Netpos Hospitality Property Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NetposAccessGuard>
          {children}
        </NetposAccessGuard>
      </body>
    </html>
  );
}
