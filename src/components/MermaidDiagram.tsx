import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../contexts/ThemeContext';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const { theme } = useTheme();
  const elementRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Configure mermaid based on current theme
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      themeVariables: theme === 'dark' ? {
        primaryColor: '#3b82f6',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#1e40af',
        lineColor: '#6b7280',
        sectionBkgColor: '#1f2937',
        altSectionBkgColor: '#374151',
        gridColor: '#4b5563',
        secondaryColor: '#4f46e5',
        tertiaryColor: '#1e3a8a',
        background: '#111827',
        secondaryBackground: '#1f2937',
        mainBkg: '#1f2937',
        secondBkg: '#374151',
        darkTextColor: '#ffffff',
      } : {
        primaryColor: '#3b82f6',
        primaryTextColor: '#1f2937',
        primaryBorderColor: '#1e40af',
        lineColor: '#6b7280',
        sectionBkgColor: '#f9fafb',
        altSectionBkgColor: '#f3f4f6',
        gridColor: '#e5e7eb',
        secondaryColor: '#4f46e5',
        tertiaryColor: '#3730a3',
      },
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 16,
    });
  }, [theme]);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!elementRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        // Generate unique ID for this diagram
        const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Clear previous content
        elementRef.current.innerHTML = '';

        // Validate and render the diagram
        const isValid = await mermaid.parse(chart);
        if (!isValid) {
          throw new Error('Invalid Mermaid syntax');
        }

        const { svg } = await mermaid.render(diagramId, chart);
        
        if (elementRef.current) {
          elementRef.current.innerHTML = svg;
          
          // Apply responsive scaling
          const svgElement = elementRef.current.querySelector('svg');
          if (svgElement) {
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';
          }
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [chart]);

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
            <code>{chart}</code>
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className={`my-4 ${className}`}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
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
        <div className="p-6 bg-white dark:bg-gray-900 text-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mb-3"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading diagram...</p>
            </div>
          ) : (
            <div 
              ref={elementRef}
              className="mermaid-diagram overflow-x-auto"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MermaidDiagram;