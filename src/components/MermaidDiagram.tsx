import React, { useEffect, useState, useMemo } from 'react';
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

  public async parse(code: string): Promise<boolean> {
    return await mermaid.parse(code);
  }
}

const mermaidService = MermaidService.getInstance();

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [svgContent, setSvgContent] = useState<string>('');
  const chartContent = chart?.trim() || '';

  console.log('MermaidDiagram: Component mounted with chart:', chartContent);
  console.log('MermaidDiagram: Chart type:', typeof chartContent);
  console.log('MermaidDiagram: Chart length:', chartContent?.length);
  console.log('MermaidDiagram: Chart content preview:', chartContent?.substring(0, 100));

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
        
        console.log('MermaidDiagram: Initializing mermaid service');
        await mermaidService.initialize(config);
        console.log('MermaidDiagram: Mermaid service initialized');
      } catch (err) {
        console.error('MermaidDiagram: Failed to initialize mermaid:', err);
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
        console.log('MermaidDiagram: No chart content');
        setIsLoading(false);
        return;
      }

      try {
        console.log('MermaidDiagram: Starting chart render');
        setIsLoading(true);
        setError(null);
        setSvgContent('');

        // Validate syntax
        console.log('MermaidDiagram: Validating syntax');
        await mermaidService.parse(chartContent);
        console.log('MermaidDiagram: Syntax validation passed');

        // Render chart
        console.log('MermaidDiagram: Rendering chart with ID:', chartId);
        const { svg } = await mermaidService.render(chartId, chartContent);
        console.log('MermaidDiagram: Render successful, SVG length:', svg.length);

        // Set SVG content
        setSvgContent(svg);
        setIsLoading(false);
        console.log('MermaidDiagram: Chart rendered successfully');
      } catch (err) {
        console.error('MermaidDiagram: Render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chartContent, chartId]);

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
        <p className="text-red-600 dark:text-red-400 text-sm">
          {error}
        </p>
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

  return (
    <div className={`my-6 ${className}`}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
            MERMAID DIAGRAM
          </span>
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
              <span className="text-xs">Rendering...</span>
            </div>
          )}
        </div>
        <div className="p-6 bg-white dark:bg-gray-900">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mb-3"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading diagram...</p>
            </div>
          ) : (
            <div 
              className="mermaid-diagram overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: svgContent }}
              style={{
                maxWidth: '100%',
                textAlign: 'center'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MermaidDiagram;