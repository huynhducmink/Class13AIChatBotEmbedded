
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import PdfViewerPage from "./PdfViewerPage.tsx";
  import "./index.css";

  // Check if this is the PDF viewer page
  const isPdfViewerPage = window.location.pathname === '/pdf-viewer' || 
                          window.location.search.includes('url=');

  createRoot(document.getElementById("root")!).render(
    isPdfViewerPage ? <PdfViewerPage /> : <App />
  );
  