import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

window['VERSION'] = "1.0-TEST";
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);