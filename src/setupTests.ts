// Registers the jest-dom matchers (toBeInTheDocument, toHaveValue, ...) on
// Vitest's expect, along with their types.
import '@testing-library/jest-dom/vitest';

// jsdom ships <dialog> but not showModal/close, so MatchDetail would throw on
// open. Every browser the app targets implements these natively.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
