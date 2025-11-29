import { useEffect, useState } from 'react';
import { PdfViewer } from './components/PdfViewer';

export default function PdfViewerPage() {
  const [config, setConfig] = useState<{
    pdfUrl: string;
    page: number;
    searchText?: string;
  } | null>(null);

  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const page = parseInt(params.get('page') || '1');
    const search = params.get('search') || undefined;

    if (url) {
      setConfig({
        pdfUrl: decodeURIComponent(url),
        page,
        searchText: search,
      });
    }
  }, []);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading PDF...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-900">
      <PdfViewer
        pdfUrl={config.pdfUrl}
        pageNumber={config.page}
        searchText={config.searchText}
        onClose={() => window.close()}
      />
    </div>
  );
}
