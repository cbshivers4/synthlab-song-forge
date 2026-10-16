import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { name: string; children: ReactNode; onClose?: () => void; className?: string };

/** Keeps a crash inside one tool panel from taking down the whole studio. */
export class ToolErrorBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error) { console.error(`[${this.props.name}] crashed:`, error); }
  override render() {
    if (!this.state.error) return this.props.children;
    const { name, onClose, className } = this.props;
    return (
      <section role="alert" className={cn("space-y-3 rounded-md border border-destructive/50 bg-destructive/10 p-4", className)}>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">{name.toUpperCase()} STOPPED</h2>
        <p className="text-sm">This tool hit a problem, but your song is safe and the rest of the studio still works.</p>
        <p className="break-words font-mono text-xs text-muted-foreground">{this.state.error.message || "Unknown error"}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => this.setState({ error: null })}>Reopen {name}</Button>
          {onClose && <Button variant="outline" onClick={() => { this.setState({ error: null }); onClose(); }}>Close</Button>}
        </div>
      </section>
    );
  }
}
