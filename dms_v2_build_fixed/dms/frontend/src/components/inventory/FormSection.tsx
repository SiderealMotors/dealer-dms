export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-sm ring-1 ring-white/[0.02] backdrop-blur-sm">
      <header className="mb-4 border-b border-slate-800/80 pb-3">
        <h4 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h4>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
