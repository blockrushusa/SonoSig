import { SiteHeader } from "@/components/site-header";

type PlaceholderPageProps = {
  title: string;
  eyebrow: string;
  description: string;
};

export function PlaceholderPage({
  title,
  eyebrow,
  description,
}: PlaceholderPageProps) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="flex flex-1 items-center px-6 py-16 lg:px-16">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            {eyebrow}
          </p>
          <h1 className="text-5xl font-semibold leading-tight text-white">
            {title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-300">{description}</p>
        </div>
      </section>
    </main>
  );
}
