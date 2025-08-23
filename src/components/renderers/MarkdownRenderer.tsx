import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ArticleComponent, MarkdownContent } from '../../types/ComponentTypes';
import CodeBlock from '../CodeBlock';
import { SectionBookmark } from '../SectionBookmark';

interface MarkdownRendererProps {
  component: ArticleComponent;
  onInteraction?: (interaction: string, data?: any) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  const content = component.content as MarkdownContent;
  const { metadata } = component;

  // Custom components for ReactMarkdown
  const components = {
    code: ({ node, inline, className, children, ...props }: any) => {
      return (
        <CodeBlock className={className} inline={inline}>
          {String(children).replace(/\n$/, '')}
        </CodeBlock>
      );
    },
    h1: ({ children, ...props }: any) => {
      const headingText = typeof children === 'string' ? children : 
                         Array.isArray(children) ? children.join('') : 'Heading';
      const sectionId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      return (
        <SectionBookmark
          title={metadata.title || 'Article'}
          path={component.id}
          url={`#${component.id}`}
          sectionId={sectionId}
          sectionTitle={headingText}
          description={`Section: ${headingText}`}
          category={metadata.tags?.[0]}
        >
          <h1 {...props} className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            {children}
          </h1>
        </SectionBookmark>
      );
    },
    h2: ({ children, ...props }: any) => {
      const headingText = typeof children === 'string' ? children : 
                         Array.isArray(children) ? children.join('') : 'Section';
      const sectionId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      return (
        <SectionBookmark
          title={metadata.title || 'Article'}
          path={component.id}
          url={`#${component.id}`}
          sectionId={sectionId}
          sectionTitle={headingText}
          description={`Section: ${headingText}`}
          category={metadata.tags?.[0]}
        >
          <h2 {...props} className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">
            {children}
          </h2>
        </SectionBookmark>
      );
    },
    h3: ({ children, ...props }: any) => {
      const headingText = typeof children === 'string' ? children : 
                         Array.isArray(children) ? children.join('') : 'Subsection';
      const sectionId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      return (
        <SectionBookmark
          title={metadata.title || 'Article'}
          path={component.id}
          url={`#${component.id}`}
          sectionId={sectionId}
          sectionTitle={headingText}
          description={`Subsection: ${headingText}`}
          category={metadata.tags?.[0]}
        >
          <h3 {...props} className="text-xl font-medium mb-2 text-gray-900 dark:text-white">
            {children}
          </h3>
        </SectionBookmark>
      );
    },
    p: ({ children, ...props }: any) => (
      <p {...props} className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
        {children}
      </p>
    ),
    ul: ({ children, ...props }: any) => (
      <ul {...props} className="list-disc list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol {...props} className="list-decimal list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li {...props} className="mb-1">
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote {...props} className="border-l-4 border-blue-500 pl-4 my-4 italic text-gray-600 dark:text-gray-400">
        {children}
      </blockquote>
    ),
    a: ({ children, href, ...props }: any) => (
      <a 
        {...props} 
        href={href}
        className="text-blue-600 dark:text-blue-400 hover:underline"
        onClick={() => onInteraction?.('link_click', { href, text: children })}
      >
        {children}
      </a>
    ),
  };

  return (
    <div className="markdown-content">
      {/* Component header with metadata */}
      {metadata.title && (
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {metadata.title}
          </h1>
          {metadata.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {metadata.description}
            </p>
          )}
          {(metadata.estimatedReadTime || metadata.difficulty || metadata.tags) && (
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              {metadata.estimatedReadTime && (
                <span>📖 {metadata.estimatedReadTime} min read</span>
              )}
              {metadata.difficulty && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  metadata.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  metadata.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {metadata.difficulty}
                </span>
              )}
              {metadata.tags && (
                <div className="flex gap-1">
                  {metadata.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Render markdown content */}
      <div className="prose dark:prose-invert max-w-none">
        <ReactMarkdown components={components}>
          {content.source}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownRenderer;
