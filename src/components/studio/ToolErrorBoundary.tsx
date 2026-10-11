import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Keeps a crash inside one tool panel from taking down the whole studio. */
export class ToolErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error) { console.error(`[${this.props.name}] crashed:`, error); }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <section role="alert" className="space-y-3 rounded-md border border-destructive/50 bg-destructive/10 p-4">
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">{this.props.name.toUpperCase()} STOPPED</h2>
        <p className="text-sm">This tool hit a problem, but your song is safe and the rest of the studio still works.</p>
        <p className="break-words font-mono text-xs text-muted-foreground">{this.state.error.message || "Unknown error"}</p>
        <Button onClick={() => this.setState({ error: null })}>Reopen {this.props.name}</Button>
      </section>
    );
  }
}
