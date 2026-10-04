import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Without this, anything thrown inside <Canvas> unmounts the whole app and
 * leaves a blank page with no clue what happened — a missing model file
 * silently takes down the entire museum. Show the error instead.
 */
export class CanvasFallback extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[museum] render crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen">
        <p className="crash-title">THE MUSEUM IS CLOSED FOR REPAIRS</p>
        <p className="crash-msg">{this.state.error.message}</p>
        <p className="crash-hint">
          check the browser console, then reload
        </p>
      </div>
    );
  }
}
