import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { BookmarkButton } from './BookmarkButton';
import { SectionBookmark } from './SectionBookmark';
import CodeBlock from './CodeBlock';
import '../github-markdown.css';

const ArticleView: React.FC = () => {
  const { '*': path } = useParams<{ '*': string }>();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

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
      // Handle both inline and block code
      return (
        <CodeBlock className={className} inline={inline}>
          {String(children).replace(/\n$/, '')}
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
        <div className="sticky top-4 float-right z-10 mb-4 ml-4 mr-4">
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
      
      <article className="markdown-body">
        <ReactMarkdown components={components}>{content}</ReactMarkdown>
      </article>
    </div>
  );
};

export default ArticleView;