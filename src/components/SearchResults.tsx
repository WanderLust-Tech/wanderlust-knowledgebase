import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdvancedSearch } from '../contexts/AdvancedSearchContext';
import { AdvancedSearchComponent } from './AdvancedSearchComponent';

const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { search } = useAdvancedSearch();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      search(q);
    }
  }, [searchParams, search]);

  return <AdvancedSearchComponent />;
};

export default SearchResults;
