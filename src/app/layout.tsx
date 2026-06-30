import type { Metadata } from 'next';
import './globals.css';
import DisclaimerBanner from '@/components/DisclaimerBanner';

const DESC =
  'Explore Apple Health trends privately. Your export is parsed in your browser and never uploaded. Not a medical device.';

export const metadata: Metadata = {
  title: 'HealthLens — privacy-first health dashboard demo',
  description: DESC,
  openGraph: {
    title: 'HealthLens — privacy-first health dashboard',
    description: DESC,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'HealthLens — privacy-first health dashboard',
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <DisclaimerBanner />
        {children}
      </body>
    </html>
  );
}
