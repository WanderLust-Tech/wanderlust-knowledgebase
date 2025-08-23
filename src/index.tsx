import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './routes';
import './index.css';
import { pwaManager } from './utils/pwa';
import { BookmarkProvider } from './contexts/BookmarkContext';
import { ProgressProvider } from './contexts/ProgressContext';

// Initialize PWA functionality
pwaManager.setupOfflineHandling();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <ProgressProvider>
    <BookmarkProvider>
      <App />
    </BookmarkProvider>
  </ProgressProvider>
);