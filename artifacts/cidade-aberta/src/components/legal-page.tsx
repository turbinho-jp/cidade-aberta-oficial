import type { ReactNode } from "react";
import { Layout } from "@/components/layout";
import { LEGAL } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Layout>
      <article className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">Última atualização: {LEGAL.updatedAt}</p>
        <div className="mt-8 space-y-8 leading-relaxed text-foreground">{children}</div>
      </article>
    </Layout>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
