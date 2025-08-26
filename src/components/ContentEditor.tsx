import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { useLoading } from '../contexts/LoadingContext';
import { cmsService, ContentDetails, CreateContentRequest, UpdateContentRequest } from '../services/cmsService';

interface ContentEditorProps {
  contentType: string;
  contentId: string;
  onClose: () => void;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  contentType,
  contentId,
  onClose
}) => {
  const { addError } = useError();
  const { addLoading, removeLoading } = useLoading();

  const [isNew, setIsNew] = useState(contentId === 'new');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    tags: [] as string[],
    metadata: {} as Record<string, any>
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!isNew) {
      loadContent();
    }
  }, [contentId, contentType, isNew]);

  const loadContent = async () => {
    const loadingId = addLoading({ message: 'Loading content...' });
    try {
      const content = await cmsService.getContentDetails(contentType, contentId);
      setFormData({
        title: content.title,
        content: content.content,
        category: content.category,
        tags: content.tags,
        metadata: content.metadata
      });
    } catch (error) {
      addError({
        message: 'Failed to load content for editing',
        details: 'Content Load Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Content load error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      addError({
        message: 'Title and content are required',
        details: 'Validation Error',
        type: 'validation',
        severity: 'low'
      });
      return;
    }

    const loadingId = addLoading({ 
      message: isNew ? 'Creating content...' : 'Updating content...' 
    });
    
    try {
      if (isNew) {
        const request: CreateContentRequest = {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          tags: formData.tags,
          metadata: formData.metadata
        };
        await cmsService.createContent(contentType, request);
      } else {
        const request: UpdateContentRequest = {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          tags: formData.tags,
          metadata: formData.metadata
        };
        await cmsService.updateContent(contentType, contentId, request);
      }
      
      onClose();
    } catch (error) {
      addError({
        message: `Failed to ${isNew ? 'create' : 'update'} content`,
        details: 'Save Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Save error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleMetadataChange = (key: string, value: any) => {
    setFormData({
      ...formData,
      metadata: {
        ...formData.metadata,
        [key]: value
      }
    });
  };

  return (
    <div className="content-editor">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isNew ? '✨ Create' : '✏️ Edit'} {contentType === 'article' ? 'Article' : 'Code Example'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {isNew ? 'Create new content' : 'Edit existing content'}
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              💾 Save
            </button>
          </div>
        </div>
      </div>

      {/* Editor Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter a compelling title..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Tutorial, Guide, Reference..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddTag}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Content Type Specific Fields */}
          {contentType === 'article' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.metadata.description || ''}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
                placeholder="Brief description of the article..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {contentType === 'code-example' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Programming Language
                </label>
                <select
                  value={formData.metadata.language || 'javascript'}
                  onChange={(e) => handleMetadataChange('language', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="csharp">C#</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Difficulty
                </label>
                <select
                  value={formData.metadata.difficulty || 'beginner'}
                  onChange={(e) => handleMetadataChange('difficulty', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder={contentType === 'article' 
                ? 'Write your article content in Markdown...' 
                : 'Paste your code here...'
              }
              rows={20}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {contentType === 'article' 
                ? 'Use Markdown syntax for formatting. Content will be automatically synced with files.' 
                : 'Provide clear, well-commented code examples.'
              }
            </p>
          </div>

          {/* Publishing Options */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.metadata.isPublished || false}
                  onChange={(e) => handleMetadataChange('isPublished', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Publish immediately
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Unchecked items will be saved as drafts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
