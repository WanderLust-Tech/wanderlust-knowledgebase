import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ArticleView from './components/ArticleView';
import Breadcrumb from './components/Breadcrumb';
import { ThemeProvider } from './contexts/ThemeContext';

import { contentIndex } from './contentIndex';
import Header from './components/Header';
import SearchResults from './components/SearchResults';

const App: React.FC = () => (
  <ThemeProvider>
    <Router>
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
        <Header /> {/* Add the Header component */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar nodes={contentIndex} />
          <main className="flex-1 overflow-auto">
            <Breadcrumb />
            <Routes>
              {/* Default route redirects to introduction/overview */}
              <Route path="/" element={<Navigate to="/introduction/overview" replace />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/*" element={<ArticleView />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  </ThemeProvider>
);

export default App;