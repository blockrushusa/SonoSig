import { AuthGate } from "@/components/auth-gate";
import { CreateWatermarkStudio } from "@/components/create-watermark-studio";
import { SiteHeader } from "@/components/site-header";

export default function CreatePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AuthGate>
        <section className="flex flex-1 items-center px-6 py-8 lg:px-16">
          <CreateWatermarkStudio />
        </section>
      </AuthGate>
    </main>
  );
}
