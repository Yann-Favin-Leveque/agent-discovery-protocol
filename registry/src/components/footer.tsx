import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-accent font-mono text-sm font-bold">
              agent<span className="text-foreground">dns</span>
            </span>
            <span className="text-muted text-sm">
              — The DNS for AI Agents
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/directory"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Directory
            </Link>
            <Link
              href="/submit"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Submit
            </Link>
            <a
              href="https://github.com/Yann-Favin-Leveque/agent-discovery-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted">
            Open source under MIT License. Built for the agent economy.
          </p>
        </div>
      </div>
    </footer>
  );
}
