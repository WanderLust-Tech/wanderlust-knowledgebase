import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import mermaid from 'mermaid';
import { useTheme } from '../contexts/ThemeContext';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

// Simple counter for unique IDs
let mermaidIdCounter = 0;
const generateMermaidId = () => `mermaid-${++mermaidIdCounter}`;

// Mermaid Service Singleton
class MermaidService {
  private static instance: MermaidService;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): MermaidService {
    if (!MermaidService.instance) {
      MermaidService.instance = new MermaidService();
    }
    return MermaidService.instance;
  }

  public async initialize(config?: any): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization(config);
    return this.initializationPromise;
  }

  private async performInitialization(config?: any): Promise<void> {
    try {
      if (config) {
        mermaid.initialize(config);
      } else {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
        });
      }
      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  public async render(id: string, chart: string): Promise<{ svg: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return mermaid.render(id, chart);
  }

  public async parse(code: string): Promise<void> {
    await mermaid.parse(code);
  }
}

const mermaidService = MermaidService.getInstance();

// Parse width/height from a rendered Mermaid SVG string.
const getSvgDimensions = (svg: string): { width: number; height: number } => {
  const w = svg.match(/\bwidth="(\d+(?:\.\d+)?)"/);
  const h = svg.match(/\bheight="(\d+(?:\.\d+)?)"/);
  return {
    width: w ? parseFloat(w[1]) : 800,
    height: h ? parseFloat(h[1]) : 600,
  };
};

// Zoom level that makes the SVG fill ~90% of the viewport while keeping aspect ratio.
const fitZoom = (svgWidth: number, svgHeight: number): number => {
  const scaleW = (window.innerWidth * 0.9) / svgWidth;
  const scaleH = (window.innerHeight * 0.85) / svgHeight;
  return Math.min(1, scaleW, scaleH);
};

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [svgContent, setSvgContent] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chartContent = chart?.trim() || '';

  // Generate unique chart ID
  const chartId = useMemo(() => generateMermaidId(), [chartContent]);

  // Initialize mermaid service
  useEffect(() => {
    const initMermaid = async () => {
      try {
        const config = {
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          themeVariables: {
            primaryColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
            primaryTextColor: theme === 'dark' ? '#ffffff' : '#1f2937',
            primaryBorderColor: theme === 'dark' ? '#1e40af' : '#2563eb',
            lineColor: theme === 'dark' ? '#6b7280' : '#4b5563',
            background: theme === 'dark' ? '#111827' : '#ffffff',
            secondaryColor: theme === 'dark' ? '#4f46e5' : '#6366f1',
            tertiaryColor: theme === 'dark' ? '#1e3a8a' : '#3730a3',
            mainBkg: theme === 'dark' ? '#1f2937' : '#f9fafb',
            secondBkg: theme === 'dark' ? '#374151' : '#f3f4f6',
            darkTextColor: theme === 'dark' ? '#ffffff' : '#1f2937',
          },
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        };
        await mermaidService.initialize(config);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize mermaid');
        setIsLoading(false);
      }
    };
    initMermaid();
  }, [theme]);

  // Render chart
  useEffect(() => {
    const renderChart = async () => {
      if (!chartContent) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        setSvgContent('');
        await mermaidService.parse(chartContent);
        const { svg } = await mermaidService.render(chartId, chartContent);
        setSvgContent(svg);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setIsLoading(false);
      }
    };
    renderChart();
  }, [chartContent, chartId]);

  // Fullscreen handlers
  const openFullscreen = useCallback(() => {
    if (svgContent) {
      const { width, height } = getSvgDimensions(svgContent);
      setZoom(fitZoom(width, height));
    }
    setIsFullscreen(true);
  }, [svgContent]);

  const closeFullscreen = useCallback(() => setIsFullscreen(false), []);

  // Escape key to close overlay
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFullscreen(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, closeFullscreen]);

  // Lock body scroll while overlay is open
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  if (!chartContent) {
    return (
      <div className={`my-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg ${className}`}>
        <div className="text-yellow-700 dark:text-yellow-300">
          <strong>No Mermaid content provided</strong>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <strong>Mermaid Diagram Error</strong>
        </div>
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <details className="mt-2">
          <summary className="text-sm text-red-600 dark:text-red-400 cursor-pointer hover:underline">
            Show diagram source
          </summary>
          <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-x-auto">
            <code>{chartContent}</code>
          </pre>
        </details>
      </div>
    );
  }

  const overlay = isFullscreen ? createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) closeFullscreen(); }}
    >
      {/* Overlay toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
        <span className="text-gray-300 text-sm font-medium uppercase tracking-wide select-none">
          Mermaid Diagram
        </span>

        <div className="flex items-center gap-1">
          {/* Zoom out */}
          <button
            onClick={() => setZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
            disabled={zoom <= ZOOM_MIN}
            className="px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>

          {/* Zoom level */}
          <span className="w-14 text-center text-gray-300 text-sm tabular-nums select-none">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom in */}
          <button
            onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
            disabled={zoom >= ZOOM_MAX}
            className="px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>

          {/* Fit to screen */}
          <button
            onClick={() => {
              const { width, height } = getSvgDimensions(svgContent);
              setZoom(fitZoom(width, height));
              scrollRef.current?.scrollTo(0, 0);
            }}
            className="ml-2 px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded text-xs font-medium transition-colors"
            title="Fit to screen"
          >
            Fit
          </button>

          {/* Close */}
          <button
            onClick={closeFullscreen}
            className="ml-2 p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Close (Esc)"
            aria-label="Close fullscreen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable diagram area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto flex items-start justify-center p-8"
      >
        <div
          className="mermaid-diagram bg-white dark:bg-gray-900 rounded-lg p-6 shadow-2xl"
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{
            transformOrigin: 'top center',
            transform: `scale(${zoom})`,
            transition: 'transform 0.15s ease',
          }}
        />
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className={`my-6 ${className}`}>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
              Mermaid Diagram
            </span>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  <span className="text-xs">Rendering...</span>
                </div>
              )}
              {!isLoading && svgContent && (
                <button
                  onClick={openFullscreen}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="View fullscreen"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Fullscreen
                </button>
              )}
            </div>
          </div>
          <div className="p-6 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Loading diagram...</p>
              </div>
            ) : (
              <div
                className="mermaid-diagram overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: svgContent }}
                style={{ maxWidth: '100%', textAlign: 'center' }}
              />
            )}
          </div>
        </div>
      </div>

      {overlay}
    </>
  );
};

export default MermaidDiagram;