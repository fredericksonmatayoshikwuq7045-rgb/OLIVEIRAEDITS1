// Workaround for Uncaught TypeError: Cannot set property fetch of #<Window> which has only a getter
// In some sandboxed iFrame preview environments, window.fetch cannot be set, and if FormData.prototype.keys
// is missing or restricted, the formdata-polyfill tries to overwrite global/window.fetch.
// Declaring simple fallback iterator methods on FormData prototype skips the polyfill entirely.
if (typeof window !== "undefined" && window.FormData && !window.FormData.prototype.keys) {
  const noopIterator = function* () {};
  window.FormData.prototype.keys = window.FormData.prototype.keys || noopIterator;
  window.FormData.prototype.values = window.FormData.prototype.values || noopIterator;
  window.FormData.prototype.entries = window.FormData.prototype.entries || noopIterator;
  if (!window.FormData.prototype[Symbol.iterator]) {
    window.FormData.prototype[Symbol.iterator] = window.FormData.prototype.entries;
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
