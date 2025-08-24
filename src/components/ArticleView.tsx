import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { BookmarkButton } from './BookmarkButton';
import { SectionBookmark } from './SectionBookmark';
import CodeBlock from './CodeBlock';
import ComponentRenderer from './ComponentRenderer';
import { VideoTutorialPage } from './VideoTutorialPage';
import AIContentSuggestions from './AIContentSuggestions';
import { ArticleComponent, InteractiveDiagramContent } from '../types/ComponentTypes';
import '../github-markdown.css';

const ArticleView: React.FC = () => {
  const { '*': path } = useParams<{ '*': string }>();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

  // Check if this is a video tutorial path
  const isVideoTutorialPath = path && (
    path.startsWith('video-tutorials/') && path !== 'video-tutorials/overview' ||
    path.startsWith('video-series/')
  );

  // If it's a video tutorial path, render the video tutorial component
  if (isVideoTutorialPath) {
    return <VideoTutorialPage />;
  }

  // Helper function to estimate reading time
  const estimateReadingTime = (text: string): number => {
    const wordsPerMinute = 200; // Average reading speed
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  useEffect(() => {
    fetch(`/content/${path}.md`)
      .then(res => res.text())
      .then(markdownContent => {
        setContent(markdownContent);
        
        // Extract title from markdown content (first # heading)
        const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          setTitle(titleMatch[1]);
        } else {
          // Fallback to path-based title
          const pathParts = path?.split('/') || [];
          const fileName = pathParts[pathParts.length - 1] || '';
          setTitle(fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
        }
      })
      .catch(() => {
        setContent('# Not Found');
        setTitle('Not Found');
      });
  }, [path]);

  // Scroll to top when navigating to a new article
  useEffect(() => {
    // Find the scrollable content area (the div that contains Routes)
    const scrollableElement = document.querySelector('main > div');
    if (scrollableElement) {
      scrollableElement.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [path]); // Trigger when path changes

  // Helper function to get category from path
  const getCategory = () => {
    if (!path) return undefined;
    const pathParts = path.split('/');
    return pathParts[0]; // First part of path as category
  };

  // Custom renderer for code blocks to add bookmark functionality
  const components = {
    code: ({ node, inline, className, children, ...props }: any) => {
      const codeContent = String(children).replace(/\n$/, '');
      
      // Check if this is a special component type
      if (className === 'language-interactive-diagram' && !inline) {
        try {
          const diagramData: InteractiveDiagramContent = JSON.parse(codeContent);
          const component: ArticleComponent = {
            id: `diagram-${Math.random().toString(36).substr(2, 9)}`,
            type: 'interactive-diagram',
            content: diagramData,
            metadata: {
              id: `diagram-${Math.random().toString(36).substr(2, 9)}`,
              title: diagramData.title,
              description: diagramData.description,
            }
          };
          
          return <ComponentRenderer component={component} />;
        } catch (error) {
          console.error('Failed to parse interactive diagram:', error);
          return (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              <strong>Error:</strong> Invalid interactive diagram configuration
              <details className="mt-2">
                <summary className="cursor-pointer">Show details</summary>
                <pre className="mt-2 text-sm">{error instanceof Error ? error.message : 'Unknown error'}</pre>
              </details>
            </div>
          );
        }
      }
      
      // Handle regular code blocks
      return (
        <CodeBlock className={className} inline={inline}>
          {codeContent}
        </CodeBlock>
      );
    },
    pre: ({ children, ...props }: any) => {
      // Check if this is a code block (has code element as child)
      const codeChild = React.Children.toArray(children).find(
        (child: any) => child?.props?.className?.startsWith('language-')
      );
      
      if (codeChild && typeof codeChild === 'object' && 'props' in codeChild) {
        const codeContent = codeChild.props.children;
        if (typeof codeContent === 'string' && codeContent.length > 100) {
          // Only add bookmark for substantial code blocks
          const sectionId = `code-${Math.random().toString(36).substr(2, 9)}`;
          return (
            <SectionBookmark
              title={title}
              path={path || ''}
              url={location.pathname}
              sectionId={sectionId}
              sectionTitle="Code Block"
              description="Code snippet from this page"
              category={getCategory()}
            >
              {children}
            </SectionBookmark>
          );
        }
      }
      return <pre {...props}>{children}</pre>;
    },
    h2: ({ children, ...props }: any) => {
      const headingText = typeof children === 'string' ? children : 
                         Array.isArray(children) ? children.join('') : 'Section';
      const sectionId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      return (
        <SectionBookmark
          title={title}
          path={path || ''}
          url={location.pathname}
          sectionId={sectionId}
          sectionTitle={headingText}
          description={`Section: ${headingText}`}
          category={getCategory()}
        >
          <h2 {...props}>{children}</h2>
        </SectionBookmark>
      );
    },
    h3: ({ children, ...props }: any) => {
      const headingText = typeof children === 'string' ? children : 
                         Array.isArray(children) ? children.join('') : 'Subsection';
      const sectionId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      return (
        <SectionBookmark
          title={title}
          path={path || ''}
          url={location.pathname}
          sectionId={sectionId}
          sectionTitle={headingText}
          description={`Subsection: ${headingText}`}
          category={getCategory()}
        >
          <h3 {...props}>{children}</h3>
        </SectionBookmark>
      );
    },
  };

  return (
    <div className="relative">
      {/* Page Bookmark Button */}
      {title && path && (
        <div className="sticky top-16 float-right z-10 mb-4 ml-4 mr-4">
          <BookmarkButton
            title={title}
            path={path}
            url={location.pathname}
            description={`Full page: ${title}`}
            category={getCategory()}
            showLabel={true}
            className="bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
          />
        </div>
      )}
      
      <article className="markdown-body pt-4">
        <ReactMarkdown components={components}>{content}</ReactMarkdown>
      </article>
      
      {/* AI Content Suggestions */}
      {path && content && (
        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
          <AIContentSuggestions
            contentPath={`/content/${path}.md`}
            userId="user-1"
            showPersonalized={true}
            maxSuggestions={5}
            onSuggestionImplement={(suggestion) => {
              console.log('Suggestion implemented:', suggestion.title);
            }}
            onSuggestionFeedback={(suggestionId, feedback) => {
              console.log('Feedback provided:', suggestionId, feedback);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ArticleView;