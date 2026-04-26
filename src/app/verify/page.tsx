import { SiteHeader } from "@/components/site-header";
import { VerifyWatermarkStudio } from "@/components/verify-watermark-studio";

export default function VerifyPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <VerifyWatermarkStudio />
      </section>
    </main>
  );
}
