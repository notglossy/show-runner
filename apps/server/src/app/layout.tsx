import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShowRunner',
  description: 'Self-hosted dashboard kiosk',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
