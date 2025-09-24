window.global = window;
import './global-polyfill.js';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './utils/store';
import App from './App.jsx';

import './index.css';
import './styles/dashboard.simple.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
