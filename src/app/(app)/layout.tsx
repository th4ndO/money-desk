import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-28 md:pb-12">{children}</main>
    </ToastProvider>
  );
}
