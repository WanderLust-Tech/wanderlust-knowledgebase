import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './routes';
import './index.css';
import { pwaManager } from './utils/pwa';

// Initialize PWA functionality
pwaManager.setupOfflineHandling();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);