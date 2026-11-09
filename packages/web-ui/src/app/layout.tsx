import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EI-AIOS | Energy Intelligence AI Operating System',
  description: 'Plataforma Operacional Autônoma para Eficiência Energética e Inteligência Regulatória',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
