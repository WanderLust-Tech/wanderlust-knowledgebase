import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ArticleView from './components/ArticleView';
import Breadcrumb from './components/Breadcrumb';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import CommunityPage from './components/CommunityPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';

import { contentIndex } from './contentIndex';
import Header from './components/Header';
import SearchResults from './components/SearchResults';

const App: React.FC = () => (
  <ThemeProvider>
    <SidebarProvider>
      <Router>
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
          <Header /> {/* Add the Header component */}
          <div className="flex flex-1 overflow-hidden">
            <Sidebar nodes={contentIndex} />
            <main className="flex-1 flex flex-col overflow-hidden">
              <Breadcrumb />
              <div className="flex-1 overflow-auto">
                <Routes>
                  {/* Default route redirects to introduction/overview */}
                  <Route path="/" element={<Navigate to="/introduction/overview" replace />} />
                  <Route path="/search" element={<SearchResults />} />
                  <Route path="/progress" element={<ProgressDashboard />} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/analytics" element={<AnalyticsDashboard />} />
                  <Route path="/*" element={<ArticleView />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </Router>
    </SidebarProvider>
  </ThemeProvider>
);

export default App;