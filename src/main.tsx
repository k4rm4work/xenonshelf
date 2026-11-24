import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Titillium Web (SIL Open Font License), bundled so the app never reaches out to a font CDN.
// Each file covers Latin and Latin Extended, so Polish letters come from the same face.
import '@fontsource/titillium-web/300.css';
import '@fontsource/titillium-web/400.css';
import '@fontsource/titillium-web/600.css';
import '@fontsource/titillium-web/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
