import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../contexts/ThemeContext';

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline }) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  // Extract language from className (e.g., "language-typescript" -> "typescript")
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  // For inline code, return simple styled span
  if (inline || !language) {
    return (
      <code className="bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  // Copy to clipboard functionality
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Choose theme based on current app theme
  const syntaxTheme = theme === 'dark' ? vscDarkPlus : vs;

  return (
    <div className="relative group my-4">
      {/* Language label and copy button */}
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
        <span className="text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className={`
            flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all duration-200
            ${copied 
              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
            }
          `}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Syntax highlighted code */}
      <SyntaxHighlighter
        style={syntaxTheme}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 0.5rem 0.5rem',
          border: 'none',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
        codeTagProps={{
          style: {
            fontSize: '14px',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace',
          }
        }}
        showLineNumbers={children.split('\n').length > 5} // Show line numbers for longer code blocks
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: theme === 'dark' ? '#6b7280' : '#9ca3af',
          borderRight: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
          marginRight: '1em',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;
