import Link from "next/link";

export function PlaceholderPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="mt-4 text-lg text-muted">{subtitle}</p>
      <div className="mt-2 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
        Coming soon
      </div>
      <Link
        href="/"
        className="mt-8 text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Back home
      </Link>
    </div>
  );
}
