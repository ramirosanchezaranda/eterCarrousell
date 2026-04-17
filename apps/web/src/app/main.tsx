import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { App } from './App';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';
import { useAssetsStore } from '@/state/assetsStore';

// Dev: expone stores en window para debug interactivo desde la consola.
import { smartUndo, smartRedo } from '@/features/editor/useKeyboardShortcuts';
(globalThis as unknown as Record<string, unknown>).__projectStore = useProjectStore;
(globalThis as unknown as Record<string, unknown>).__uiStore = useUiStore;
(globalThis as unknown as Record<string, unknown>).__assetsStore = useAssetsStore;
(globalThis as unknown as Record<string, unknown>).__smartUndo = smartUndo;
(globalThis as unknown as Record<string, unknown>).__smartRedo = smartRedo;

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
