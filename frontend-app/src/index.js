import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';
import reportWebVitals from './reportWebVitals';
import { registerServiceWorker } from './lib/push';
import { configureCapacitorRuntime } from './lib/capacitorRuntime';

configureCapacitorRuntime();

// Register the service worker early so it's ready when the user opts into push.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().catch((err) => console.error('[sw] register failed:', err));
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
