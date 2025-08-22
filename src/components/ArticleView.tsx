import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import '../github-markdown.css';

const ArticleView: React.FC = () => {
  const { '*': path } = useParams<{ '*': string }>();
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(`/content/${path}.md`)
      .then(res => res.text())
      .then(setContent)
      .catch(() => setContent('# Not Found'));
  }, [path]);

  // Scroll to top when navigating to a new article
  useEffect(() => {
    // Find the main content area (the scrollable container)
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [path]); // Trigger when path changes

  return (
    <article className="markdown-body">
      <ReactMarkdown>{content}</ReactMarkdown>
    </article>
  );
};

export default ArticleView;