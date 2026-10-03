import { GuruSidebar } from "@/components/guru-sidebar";

export default function GuruLayout({ children }: LayoutProps<"/guru">) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 sm:flex-row">
      <GuruSidebar />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
