import React from 'react';
import ReactDOM from 'react-dom/client';
import './theme/global.css';
import { registerCustomIndicators } from '@/chart/customIndicators';
import { registerCustomOverlays } from '@/chart/customOverlays';
import App from './App';

// Register custom indicators and overlays before chart init
registerCustomIndicators();
registerCustomOverlays();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
