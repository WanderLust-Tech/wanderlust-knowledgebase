import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ArticleView from './components/ArticleView';
import Breadcrumb from './components/Breadcrumb';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ErrorProvider } from './contexts/ErrorContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { AuthProvider } from './contexts/AuthContext';
import ErrorDisplay from './components/ErrorDisplay';
import LoadingDisplay from './components/LoadingDisplay';
import RealTimeNotifications from './components/RealTimeNotifications';
import CommunityPage from './components/CommunityPage';
import ApiCommunityPage from './components/ApiCommunityPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ContentVersioningPage from './components/ContentVersioningPage';
import AIContentSuggestionsPage from './components/AIContentSuggestionsPage';
import CodeExamplesRepository from './components/CodeExamplesRepository';
import ArticleSyncPage from './components/ArticleSyncPage';
import RealTimeDemoPage from './components/RealTimeDemoPage';
import { CMSDashboard } from './components/CMSDashboard';

import { contentIndex } from './contentIndex';
import Header from './components/Header';
import SearchResults from './components/SearchResults';

const App: React.FC = () => (
  <ErrorProvider>
    <LoadingProvider>
      <ThemeProvider>
        <AuthProvider>
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
                        <Route path="/real-time-demo" element={<RealTimeDemoPage />} />
                        <Route path="/api-community" element={<ApiCommunityPage />} />
                        <Route path="/analytics" element={<AnalyticsDashboard />} />
                        <Route path="/code-examples" element={<CodeExamplesRepository />} />
                        <Route path="/content-sync" element={<ArticleSyncPage />} />
                        <Route path="/cms" element={<CMSDashboard />} />
                        <Route path="/versioning/:contentPath?" element={<ContentVersioningPage />} />
                        <Route path="/ai-suggestions/:contentPath?" element={<AIContentSuggestionsPage />} />
                        <Route path="/*" element={<ArticleView />} />
                      </Routes>
                    </div>
                  </main>
                </div>
              </div>
              
              {/* Global Error and Loading Display */}
              <ErrorDisplay position="top-right" maxErrors={3} />
              <LoadingDisplay showGlobalOverlay={true} showInlineLoaders={false} />
              
              {/* Real-time Notifications */}
              <RealTimeNotifications position="bottom-right" maxNotifications={5} />
            </Router>
          </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </LoadingProvider>
  </ErrorProvider>
);

export default App;