import React, { useState, useEffect } from 'react';
import { useGitHubService } from '../../services/githubService';
import { Repository } from '../../types/github';
import { useEventTracker } from '../../services/eventTracker';
import styles from './RepositoryConfirmationModal.module.css';

interface RepositoryConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (repo: Repository) => void;
  initialRepo?: Repository | null;
  demandId?: number;
}

export const RepositoryConfirmationModal: React.FC<RepositoryConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialRepo = null,
  demandId
}) => {
  const { fetchUserRepos, fetchRepoDetails } = useGitHubService();
  const { trackEvent } = useEventTracker();
  
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(initialRepo);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cacheStatus, setCacheStatus] = useState<'checking' | 'cached' | 'fresh' | 'error'>('checking');

  useEffect(() => {
    if (isOpen) {
      loadRepositories();
      trackEvent('repository_modal_opened', {
        demandId,
        initialRepo: initialRepo?.full_name
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialRepo) {
      setSelectedRepo(initialRepo);
    }
  }, [initialRepo]);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      setCacheStatus('checking');

      // Try to load from cache first
      const cachedRepos = localStorage.getItem('githubReposCache');
      if (cachedRepos) {
        const parsedRepos = JSON.parse(cachedRepos);
        const cacheTimestamp = localStorage.getItem('githubReposCacheTimestamp');
        
        if (cacheTimestamp) {
          const cacheAge = Date.now() - parseInt(cacheTimestamp);
          const cacheHours = cacheAge / (1000 * 60 * 60);
          
          if (cacheHours < 1) { // Cache valid for 1 hour
            setRepositories(parsedRepos);
            setCacheStatus('cached');
            
            // Refresh in background
            refreshRepositoriesInBackground();
            return;
          }
        }
      }

      // Fetch fresh data
      const repos = await fetchUserRepos();
      setRepositories(repos);
      setCacheStatus('fresh');
      
      // Cache the results
      localStorage.setItem('githubReposCache', JSON.stringify(repos));
      localStorage.setItem('githubReposCacheTimestamp', Date.now().toString());
      
    } catch (err) {
      console.error('Error loading repositories:', err);
      setError('Failed to load repositories. Please try again.');
      setCacheStatus('error');
      
      // Try to load from cache as fallback
      const cachedRepos = localStorage.getItem('githubReposCache');
      if (cachedRepos) {
        setRepositories(JSON.parse(cachedRepos));
        setCacheStatus('cached');
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshRepositoriesInBackground = async () => {
    try {
      const freshRepos = await fetchUserRepos();
      // Update cache without disrupting UI
      localStorage.setItem('githubReposCache', JSON.stringify(freshRepos));
      localStorage.setItem('githubReposCacheTimestamp', Date.now().toString());
    } catch (err) {
      console.error('Background refresh failed:', err);
    }
  };

  const handleRepoSelect = async (repo: Repository) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch detailed repo info
      const detailedRepo = await fetchRepoDetails(repo.owner.login, repo.name);
      setSelectedRepo(detailedRepo);
      
      trackEvent('repository_selected', {
        demandId,
        repo: detailedRepo.full_name,
        repoId: detailedRepo.id
      });
      
    } catch (err) {
      console.error('Error fetching repo details:', err);
      setError('Failed to load repository details.');
      setSelectedRepo(repo); // Fallback to basic info
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedRepo) {
      trackEvent('repository_confirmed', {
        demandId,
        repo: selectedRepo.full_name,
        repoId: selectedRepo.id
      });
      onConfirm(selectedRepo);
      onClose();
    }
  };

  const handleCancel = () => {
    trackEvent('repository_modal_cancelled', {
      demandId,
      hadSelection: !!selectedRepo
    });
    onClose();
  };

  const filteredRepos = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Select GitHub Repository</h2>
          <button 
            className={styles.closeButton} 
            onClick={handleCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {error && (
            <div className={styles.errorMessage}>
              {error}
              <button 
                className={styles.retryButton}
                onClick={loadRepositories}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Retry'}
              </button>
            </div>
          )}

          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            <span className={styles.searchIcon}>🔍</span>
          </div>

          {cacheStatus === 'checking' && (
            <div className={styles.cacheStatus}>Checking cache...</div>
          )}

          {cacheStatus === 'cached' && (
            <div className={styles.cacheStatus}>
              📦 Showing cached repositories (last updated: {new Date(parseInt(localStorage.getItem('githubReposCacheTimestamp') || '0')).toLocaleString()})
            </div>
          )}

          {cacheStatus === 'fresh' && (
            <div className={styles.cacheStatus}>✅ Repositories loaded fresh from GitHub</div>
          )}

          {loading && !repositories.length ? (
            <div className={styles.loadingIndicator}>
              <div className={styles.spinner}></div>
              Loading repositories...
            </div>
          ) : (
            <div className={styles.repoListContainer}>
              {filteredRepos.length === 0 ? (
                <div className={styles.noReposMessage}>
                  {searchTerm ? 'No repositories match your search.' : 'No repositories found.'}
                </div>
              ) : (
                <ul className={styles.repoList}>
                  {filteredRepos.map((repo) => (
                    <li 
                      key={repo.id}
                      className={
                        `${styles.repoItem} $
                        ${selectedRepo?.id === repo.id ? styles.repoItemSelected : ''}
                        ${repo.private ? styles.repoItemPrivate : ''}
                        `
                      }
                      onClick={() => handleRepoSelect(repo)}
                    >
                      <div className={styles.repoInfo}>
                        <div className={styles.repoMain}>
                          <span className={styles.repoName}>{repo.name}</span>
                          <span className={styles.repoOwner}>@{repo.owner.login}</span>
                          {repo.private && <span className={styles.privateBadge}>Private</span>}
                        </div>
                        {repo.description && (
                          <div className={styles.repoDescription}>{repo.description}</div>
                        )}
                        <div className={styles.repoMeta}>
                          <span className={styles.repoLanguage}>{repo.language || 'Unknown'}</span>
                          <span className={styles.repoStars}>⭐ {repo.stargazers_count}</span>
                          <span className={styles.repoUpdated}>
                            Updated {new Date(repo.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className={styles.repoSelectIndicator}>
                        {selectedRepo?.id === repo.id ? '✓' : '→'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.selectedRepoInfo}>
            {selectedRepo ? (
              <div className={styles.selectionSummary}>
                <span className={styles.selectionLabel}>Selected:</span>
                <span className={styles.selectionName}>{selectedRepo.full_name}</span>
                {selectedRepo.private && <span className={styles.selectionPrivate}>Private</span>}
              </div>
            ) : (
              <div className={styles.noSelection}>No repository selected</div>
            )}
          </div>
          
          <div className={styles.buttonGroup}>
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            
            <button
              className={
                `${styles.confirmButton} $
                ${!selectedRepo || loading ? styles.confirmButtonDisabled : ''}
                `
              }
              onClick={handleConfirm}
              disabled={!selectedRepo || loading}
            >
              {loading ? (
                <>
                  <span className={styles.buttonSpinner}></span>
                  Confirming...
                </>
              ) : (
                'Confirm Repository'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};