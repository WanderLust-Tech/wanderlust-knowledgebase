import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HybridSidebar from './components/HybridSidebar';
import EnhancedArticleView from './components/EnhancedArticleView';
import ArticleView from './components/ArticleView'; // Keep as fallback
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
import ProtectedRoute from './components/auth/ProtectedRoute';
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
                <Header />
                <div className="flex flex-1 overflow-hidden">
                  <HybridSidebar fallbackNodes={contentIndex} />
                  <main className="flex-1 flex flex-col overflow-hidden">
                    <Breadcrumb />
                    <div className="flex-1 overflow-auto">
                      <Routes>
                        {/* Default route redirects to introduction/overview */}
                        <Route path="/" element={<Navigate to="/introduction/overview" replace />} />
                        <Route path="/search" element={<SearchResults />} />
                        <Route path="/progress" element={
                          <ProtectedRoute 
                            fallback={
                              <div className="max-w-4xl mx-auto p-6">
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                                  <div className="flex items-center space-x-3 mb-4">
                                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200">Learning Progress Tracking</h2>
                                  </div>
                                  <p className="text-blue-700 dark:text-blue-300 mb-4">
                                    Track your learning journey, monitor reading progress, and create personalized learning paths.
                                  </p>
                                  <p className="text-blue-600 dark:text-blue-400 mb-6">
                                    Sign in to access your personal progress dashboard and unlock advanced learning features.
                                  </p>
                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Features available with an account:</h3>
                                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                      <li>• Track reading progress across all articles</li>
                                      <li>• Create custom learning paths</li>
                                      <li>• View learning analytics and insights</li>
                                      <li>• Export/import your progress data</li>
                                      <li>• Get personalized content recommendations</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            }
                            showLogin={true}
                          >
                            <ProgressDashboard />
                          </ProtectedRoute>
                        } />
                        <Route path="/community" element={<CommunityPage />} />
                        <Route path="/real-time-demo" element={<RealTimeDemoPage />} />
                        <Route path="/api-community" element={<ApiCommunityPage />} />
                        <Route path="/analytics" element={<AnalyticsDashboard />} />
                        <Route path="/code-examples" element={<CodeExamplesRepository />} />
                        <Route path="/content-sync" element={<ArticleSyncPage />} />
                        <Route path="/cms" element={<CMSDashboard />} />
                        <Route path="/versioning/:contentPath?" element={<ContentVersioningPage />} />
                        <Route path="/ai-suggestions/:contentPath?" element={<AIContentSuggestionsPage />} />
                        <Route path="/*" element={<EnhancedArticleView />} />
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
