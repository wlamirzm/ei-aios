export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white">
      {children}
    </div>
  );
}
