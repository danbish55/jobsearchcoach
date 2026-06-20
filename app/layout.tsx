import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JobSearchCoach',
  description: 'Your personal AI career coach',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/png" href="/assets/usc-trojan-logo-transparent.png" />
        <link rel="stylesheet" href="/css/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
