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
import { contentService, ContentMetadata } from '../services/ContentService';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import '../github-markdown.css';

const EnhancedArticleView: React.FC = () => {
  const { '*': path } = useParams<{ '*': string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { addLoading, removeLoading } = useLoading();
  
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentSource, setContentSource] = useState<'api' | 'static' | 'cache'>('static');

  // Check if this is a video tutorial path
  const isVideoTutorialPath = path && (
    path.startsWith('video-tutorials/') && path !== 'video-tutorials/overview' ||
    path.startsWith('video-series/')
  );

  // If it's a video tutorial path, render the video tutorial component
  if (isVideoTutorialPath) {
    return <VideoTutorialPage />;
  }

  useEffect(() => {
    loadContent();
  }, [path]);

  const loadContent = async () => {
    if (!path) {
      setContent('# Welcome\n\nPlease select an article from the sidebar.');
      setMetadata({
        title: 'Welcome',
        category: 'general',
        tags: [],
        lastUpdated: new Date()
      });
      setIsLoading(false);
      return;
    }

    const loadingId = addLoading({ message: 'Loading article...' });
    setIsLoading(true);
    setError(null);

    try {
      const result = await contentService.getContent(path);
      
      setContent(result.content);
      setMetadata(result.metadata);
      
      // Determine content source for debugging/info
      if (result.content.includes('<!-- API_SOURCE -->')) {
        setContentSource('api');
      } else {
        setContentSource('static');
      }

    } catch (error) {
      console.error('Failed to load content:', error);
      setError(error instanceof Error ? error.message : 'Failed to load content');
      
      // Set fallback content
      setContent(`# Content Not Found\n\nThe requested article "${path}" could not be loaded.\n\nThis might be because:\n- The article doesn't exist\n- There's a network connection issue\n- The API is temporarily unavailable\n\nPlease try refreshing the page or contact support if the issue persists.`);
      setMetadata({
        title: 'Content Not Found',
        category: 'error',
        tags: [],
        lastUpdated: new Date()
      });
    } finally {
      removeLoading(loadingId);
      setIsLoading(false);
    }
  };

  const refreshContent = async () => {
    // Clear cache and reload
    contentService.clearCache();
    await loadContent();
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 lg:p-8 overflow-auto bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const estimateReadingTime = (text: string): number => {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  const readingTime = metadata?.readingTime || estimateReadingTime(content);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-auto bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Article Header */}
        <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {metadata?.title || 'Loading...'}
              </h1>
              
              {/* Article Metadata */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {metadata?.category && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {metadata.category}
                  </span>
                )}
                
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {readingTime} min read
                </span>

                {metadata?.lastUpdated && (
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Updated {metadata.lastUpdated.toLocaleDateString()}
                  </span>
                )}

                {metadata?.author && (
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {metadata.author}
                  </span>
                )}

                {/* Content Source Indicator (for debugging) */}
                {import.meta.env.DEV && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-mono ${
                    contentSource === 'api' ? 'bg-green-100 text-green-800' : 
                    contentSource === 'static' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {contentSource.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Tags */}
              {metadata?.tags && metadata.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {metadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 ml-4">
              {/* Refresh Button */}
              <button
                onClick={refreshContent}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Refresh content"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Bookmark Button */}
              <BookmarkButton 
                path={path || ''} 
                title={metadata?.title || ''} 
                url={location.pathname}
              />
            </div>
          </div>
        </div>

        {/* Article Content */}
        <article className="prose prose-lg dark:prose-invert max-w-none markdown-body group">
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                return !inline && language ? (
                  <div className="relative">
                    <CodeBlock className={className}>{String(children).replace(/\n$/, '')}</CodeBlock>
                  </div>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              h1: ({ node, children, ...props }) => (
                <h1 {...props}>{children}</h1>
              ),
              h2: ({ node, children, ...props }) => (
                <h2 {...props}>{children}</h2>
              ),
              h3: ({ node, children, ...props }) => (
                <h3 {...props}>{children}</h3>
              ),
              // Handle interactive components
              p: ({ node, children, ...props }) => {
                // Check if this paragraph contains component markup
                const childString = String(children);
                if (childString.includes('{{') && childString.includes('}}')) {
                  try {
                    const componentData = JSON.parse(childString.replace('{{', '{').replace('}}', '}'));
                    return <ComponentRenderer component={componentData as ArticleComponent} />;
                  } catch (e) {
                    // If parsing fails, render as normal paragraph
                    return <p {...props}>{children}</p>;
                  }
                }
                return <p {...props}>{children}</p>;
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </article>

        {/* AI Suggestions (if user is authenticated) */}
        {user && path && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <AIContentSuggestions contentPath={path} />
          </div>
        )}

        {/* Debug Information (development only) */}
        {import.meta.env.DEV && (
          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
            <h4 className="font-semibold mb-2">Debug Information</h4>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div>Path: {path}</div>
              <div>Source: {contentSource}</div>
              <div>Content Length: {content.length} characters</div>
              <div>Reading Time: {readingTime} minutes</div>
              {metadata && (
                <div>Last Updated: {metadata.lastUpdated.toISOString()}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedArticleView;
