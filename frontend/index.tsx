import './vertex-ai-proxy-interceptor.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

let root = (window as any).__react_root;
if (!root) {
  root = ReactDOM.createRoot(rootElement);
  (window as any).__react_root = root;
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
