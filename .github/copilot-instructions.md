# Copilot Instructions for Wanderlust Knowledge Base

## Project Overview

This is a comprehensive interactive knowledge base for Chromium development built with React 18, TypeScript, and Vite. The application features advanced search capabilities, progressive web app functionality, progress tracking, and interactive learning experiences.

## Technology Stack & Architecture

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite with React plugin
- **Styling**: Tailwind CSS with responsive design
- **Routing**: React Router with hash-based routing for static hosting
- **Content**: Markdown processing with react-markdown
- **Search**: Fuzzy search implementation with content indexing
- **Code Editor**: Monaco Editor integration for interactive code examples
- **Icons**: Custom PWA icon generation with Canvas API
- **Deployment**: FTP deployment with GitHub Actions CI/CD

## Code Organization Guidelines

### Component Architecture
- **Location**: Place all React components in `src/components/`
- **Structure**: Use functional components with hooks (no class components)
- **TypeScript**: Always use proper TypeScript interfaces and types
- **Styling**: Use Tailwind CSS classes, avoid inline styles
- **Responsiveness**: Implement mobile-first responsive design

### File Naming Conventions
- **Components**: PascalCase for component files (e.g., `SearchInterface.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useProgressTracking.ts`)
- **Utils**: camelCase for utility functions (e.g., `searchUtils.ts`)
- **Types**: PascalCase interfaces in `src/types/` (e.g., `ContentTypes.ts`)

### State Management
- **Local State**: Use `useState` and `useReducer` for component-level state
- **Global State**: Use React Context for shared state (see `src/contexts/`)
- **Data Fetching**: Implement proper loading and error states
- **Performance**: Use `useMemo` and `useCallback` for expensive operations

## Development Workflow

### Adding New Features
1. **Content Addition**: Add markdown files to `public/content/` following the existing structure
2. **Component Development**: Create reusable components in appropriate subdirectories
3. **Search Integration**: Update search index in `scripts/build-search-index.js` for new content
4. **Type Safety**: Define proper TypeScript interfaces for new data structures
5. **Testing**: Test components in development server before building

### Content Management
- **Markdown Files**: Place content in `public/content/` with proper frontmatter
- **Images**: Store in `public/content/` subdirectories near related content
- **Search Index**: Run `npm run build-index` after adding/modifying content
- **Content Structure**: Follow existing folder hierarchy and naming patterns

### Performance Optimization
- **Lazy Loading**: Use React.lazy for route-based code splitting
- **Bundle Analysis**: Monitor build output size with Vite bundle analyzer
- **Image Optimization**: Use appropriate image formats and sizes
- **Code Splitting**: Split large components and utilities appropriately

## Environment Configuration

### Development Environment
- **Environment Files**: Use `.env.development` for local development settings
- **API Configuration**: Set up proper API endpoints and keys
- **Build Variables**: Configure Vite environment variables properly
- **Hot Reload**: Leverage Vite's fast hot reload for rapid development

### Production Configuration
- **Deployment**: Use FTP deployment scripts for production
- **Environment Variables**: Configure production environment in `.env.production`
- **Build Optimization**: Ensure proper minification and tree-shaking
- **PWA Setup**: Maintain service worker and manifest configurations

## Code Quality Standards

### TypeScript Usage
- **Strict Mode**: Use strict TypeScript configuration
- **Type Definitions**: Create proper interfaces for all data structures
- **No `any` Types**: Avoid `any` type, use proper typing
- **Import/Export**: Use named exports for utilities, default exports for components

### React Best Practices
- **Functional Components**: Use functional components with hooks exclusively
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Error Boundaries**: Implement error boundaries for robust error handling
- **Accessibility**: Follow WCAG guidelines and semantic HTML practices

### CSS/Tailwind Guidelines
- **Utility Classes**: Prefer Tailwind utility classes over custom CSS
- **Component Variants**: Use Tailwind's component variant patterns
- **Responsive Design**: Implement mobile-first responsive breakpoints
- **Dark Mode**: Support system-aware dark/light theme switching

## Content Integration

### Markdown Processing
- **Frontmatter**: Use consistent frontmatter structure for metadata
- **Code Blocks**: Implement syntax highlighting for code examples
- **Diagrams**: Support Mermaid diagrams and interactive visualizations
- **Links**: Ensure proper internal and external link handling

### Search Functionality
- **Indexing**: Maintain comprehensive search index for all content
- **Fuzzy Search**: Implement fuzzy search with content preview
- **Filters**: Support category-based and type-based filtering
- **Performance**: Optimize search queries for large content volumes

## Deployment & CI/CD

### Build Process
- **Index Generation**: Always run search index build before deployment
- **Asset Optimization**: Ensure proper asset bundling and optimization
- **Environment Variables**: Set appropriate environment for target deployment
- **Error Handling**: Implement proper error reporting for build failures

### FTP Deployment
- **Credentials**: Use secure credential management for deployment
- **Staging**: Test deployments in staging environment first
- **Rollback**: Maintain backup capabilities for quick rollback
- **Monitoring**: Monitor deployment success and application health

## Integration with Custom Browser Project

This knowledge base serves the [Wanderlust Custom Browser](../custom-browser/) project:

### Cross-Repository Coordination
- **Documentation Sync**: Keep content aligned with custom browser development
- **Feature Documentation**: Document new custom browser features promptly
- **Code Examples**: Provide working code examples for custom browser APIs
- **Update Frequency**: Maintain regular content updates as browser evolves

### Content Organization
- **Chromium Focus**: Structure content around Chromium development workflows
- **Custom Features**: Highlight and explain custom browser additions
- **Learning Paths**: Provide progressive learning experiences
- **Reference Materials**: Maintain comprehensive API and feature references

## Important Notes for AI Assistant

- **React 18**: Use modern React patterns with functional components and hooks
- **TypeScript First**: Always provide proper TypeScript types and interfaces
- **Responsive Design**: Ensure all UI components work across device sizes
- **Content Structure**: Maintain consistent markdown frontmatter and organization
- **Search Integration**: Update search indices when adding or modifying content
- **Performance**: Monitor build sizes and implement appropriate optimizations
- **PWA Features**: Maintain offline functionality and installable app capabilities
- **Cross-Browser**: Ensure compatibility across modern browsers
- **Accessibility**: Follow WCAG guidelines for inclusive design
- **Documentation**: Document complex components and utilities thoroughly

## Common Tasks

### Adding New Content
1. Create markdown file in appropriate `public/content/` subdirectory
2. Add proper frontmatter with title, description, and metadata
3. Update search index with `npm run build-index`
4. Test content rendering in development environment
5. Update navigation if creating new top-level sections

### Creating New Components
1. Create TypeScript component file in `src/components/`
2. Define proper props interface
3. Implement responsive design with Tailwind CSS
4. Add to appropriate parent component or route
5. Test component in various screen sizes and themes

### Optimizing Performance
1. Analyze bundle size with Vite build analysis
2. Implement code splitting for large components
3. Optimize images and assets
4. Review and optimize search index size
5. Test loading performance on slower connections