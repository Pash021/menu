import React from "react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") console.error(error, info);
    this.setState({ componentStack: info?.componentStack || "" });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="container flex min-h-[70vh] items-center justify-center py-10">
        <div className="w-full max-w-xl">
          <EmptyState
            title="Something went wrong"
            description={this.state.error ? String(this.state.error?.message || this.state.error) : "Unexpected error."}
          />
          {this.state.error?.stack ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded-xl border bg-card p-3 text-[11px] leading-snug text-muted-foreground">
              {String(this.state.error.stack)}
            </pre>
          ) : null}
          {this.state.componentStack ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded-xl border bg-card p-3 text-xs text-muted-foreground">
              {this.state.componentStack}
            </pre>
          ) : null}
          <div className="mt-4 flex justify-center gap-2">
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button type="button" onClick={() => window.history.back()}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
