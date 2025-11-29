import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

// Configure PDF.js worker - use the worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfViewerProps {
  pdfUrl: string;
  pageNumber?: number;
  searchText?: string;
  onClose: () => void;
}

export function PdfViewer({ pdfUrl, pageNumber = 1, searchText, onClose }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Loading PDF from URL:', pdfUrl);
        
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          withCredentials: false,
        });
        
        const pdfDoc = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdfDoc.numPages);
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(`Failed to load PDF document: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfUrl]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        // Highlight search text if provided
        if (searchText) {
          await highlightText(page, context, viewport, searchText);
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdf, currentPage, scale, searchText]);

  // Highlight text on the page
  const highlightText = async (page: any, context: CanvasRenderingContext2D, viewport: any, text: string) => {
    try {
      const textContent = await page.getTextContent();
      const searchRegex = new RegExp(text.trim(), 'gi');

      context.fillStyle = 'rgba(255, 255, 0, 0.4)';

      for (const item of textContent.items) {
        if ('str' in item && searchRegex.test(item.str)) {
          const transform = pdfjsLib.Util.transform(
            viewport.transform,
            item.transform
          );

          const x = transform[4];
          const y = transform[5];
          const width = item.width * viewport.scale;
          const height = item.height * viewport.scale;

          context.fillRect(x, viewport.height - y, width, height);
        }
      }
    } catch (err) {
      console.error('Error highlighting text:', err);
    }
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">PDF Viewer</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(pdfUrl, '_blank')}
              title="Open in new tab"
            >
              Open in New Tab
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="size-4" />
            </Button>
            <span className="text-sm w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* PDF Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 flex items-start justify-center p-4"
        >
          {loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Loading PDF...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <p className="text-red-500 mb-2 font-semibold">{error}</p>
              <p className="text-sm text-slate-500 break-all">URL: {pdfUrl}</p>
              <Button variant="outline" onClick={onClose} className="mt-4">
                Close
              </Button>
            </div>
          )}
          {!loading && !error && (
            <canvas
              ref={canvasRef}
              className="shadow-lg bg-white"
              style={{ maxWidth: '100%' }}
            />
          )}
        </div>

        {searchText && (
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900 text-sm text-center">
            Highlighting: <strong>{searchText}</strong>
          </div>
        )}
      </Card>
    </div>
  );
}
