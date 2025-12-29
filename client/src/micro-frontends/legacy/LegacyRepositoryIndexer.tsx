// Legacy Repository Indexer Micro-Frontend
// Isolated legacy code for repository indexing functionality

import React, { useState } from 'react';
import { Repository } from '../../types/github';
import { eventTracker } from '../../services/eventTracker';
import styles from './LegacyRepositoryIndexer.module.css';

interface LegacyRepositoryIndexerProps {
  onComplete: (repo: Repository) => void;
  onCancel: () => void;
  initialRepo?: Repository | null;
}

export const LegacyRepositoryIndexer: React.FC<LegacyRepositoryIndexerProps> = ({
  onComplete,
  onCancel,
  initialRepo = null
}) => {
  const [repoUrl, setRepoUrl] = useState<string>(initialRepo ? initialRepo.html_url : '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'indexing' | 'completed' | 'error'>('idle');

  const handleIndexRepository = async () => {
    if (!repoUrl) {
      setError('Please enter a repository URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStatus('indexing');

      eventTracker.trackEvent('legacy_indexer_started', {
        repoUrl,
        hasInitialRepo: !!initialRepo
      });

      // Simulate legacy indexing process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract owner and repo name from URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub repository URL');
      }

      const [, owner, repoName] = match;

      // Create mock repository object (in real implementation, this would come from API)
      const indexedRepo: Repository = {
        id: Date.now(),
        node_id: `MDEwOlJlcG9zaXRvcnk${Date.now()}`,
        name: repoName,
        full_name: `${owner}/${repoName}`,
        private: false,
        owner: {
          login: owner,
          id: 1,
          node_id: 'MDQ6VXNlcjE=',
          avatar_url: `https://github.com/${owner}.png`,
          gravatar_id: '',
          url: `https://api.github.com/users/${owner}`,
          html_url: `https://github.com/${owner}`,
          followers_url: `https://api.github.com/users/${owner}/followers`,
          following_url: `https://api.github.com/users/${owner}/following{/other_user}`,
          gists_url: `https://api.github.com/users/${owner}/gists{/gist_id}`,
          starred_url: `https://api.github.com/users/${owner}/starred{/owner}{/repo}`,
          subscriptions_url: `https://api.github.com/users/${owner}/subscriptions`,
          organizations_url: `https://api.github.com/users/${owner}/orgs`,
          repos_url: `https://api.github.com/users/${owner}/repos`,
          events_url: `https://api.github.com/users/${owner}/events{/privacy}`,
          received_events_url: `https://api.github.com/users/${owner}/received_events`,
          type: 'User',
          site_admin: false
        },
        html_url: repoUrl,
        description: 'Legacy indexed repository',
        fork: false,
        url: `https://api.github.com/repos/${owner}/${repoName}`,
        forks_url: `https://api.github.com/repos/${owner}/${repoName}/forks`,
        keys_url: `https://api.github.com/repos/${owner}/${repoName}/keys{/key_id}`,
        collaborators_url: `https://api.github.com/repos/${owner}/${repoName}/collaborators{/collaborator}`,
        teams_url: `https://api.github.com/repos/${owner}/${repoName}/teams`,
        hooks_url: `https://api.github.com/repos/${owner}/${repoName}/hooks`,
        issue_events_url: `https://api.github.com/repos/${owner}/${repoName}/issues/events{/number}`,
        events_url: `https://api.github.com/repos/${owner}/${repoName}/events`,
        assignees_url: `https://api.github.com/repos/${owner}/${repoName}/assignees{/user}`,
        branches_url: `https://api.github.com/repos/${owner}/${repoName}/branches{/branch}`,
        tags_url: `https://api.github.com/repos/${owner}/${repoName}/tags`,
        blobs_url: `https://api.github.com/repos/${owner}/${repoName}/git/blobs{/sha}`,
        git_tags_url: `https://api.github.com/repos/${owner}/${repoName}/git/tags{/sha}`,
        git_refs_url: `https://api.github.com/repos/${owner}/${repoName}/git/refs{/sha}`,
        trees_url: `https://api.github.com/repos/${owner}/${repoName}/git/trees{/sha}`,
        statuses_url: `https://api.github.com/repos/${owner}/${repoName}/statuses/{sha}`,
        languages_url: `https://api.github.com/repos/${owner}/${repoName}/languages`,
        stargazers_url: `https://api.github.com/repos/${owner}/${repoName}/stargazers`,
        contributors_url: `https://api.github.com/repos/${owner}/${repoName}/contributors`,
        subscribers_url: `https://api.github.com/repos/${owner}/${repoName}/subscribers`,
        subscription_url: `https://api.github.com/repos/${owner}/${repoName}/subscription`,
        commits_url: `https://api.github.com/repos/${owner}/${repoName}/commits{/sha}`,
        git_commits_url: `https://api.github.com/repos/${owner}/${repoName}/git/commits{/sha}`,
        comments_url: `https://api.github.com/repos/${owner}/${repoName}/comments{/number}`,
        issue_comment_url: `https://api.github.com/repos/${owner}/${repoName}/issues/comments{/number}`,
        contents_url: `https://api.github.com/repos/${owner}/${repoName}/contents/{+path}`,
        compare_url: `https://api.github.com/repos/${owner}/${repoName}/compare/{base}...{head}`,
        merges_url: `https://api.github.com/repos/${owner}/${repoName}/merges`,
        archive_url: `https://api.github.com/repos/${owner}/${repoName}/{archive_format}{/ref}`,
        downloads_url: `https://api.github.com/repos/${owner}/${repoName}/downloads`,
        issues_url: `https://api.github.com/repos/${owner}/${repoName}/issues{/number}`,
        pulls_url: `https://api.github.com/repos/${owner}/${repoName}/pulls{/number}`,
        milestones_url: `https://api.github.com/repos/${owner}/${repoName}/milestones{/number}`,
        notifications_url: `https://api.github.com/repos/${owner}/${repoName}/notifications{?since,all,participating}`,
        labels_url: `https://api.github.com/repos/${owner}/${repoName}/labels{/name}`,
        releases_url: `https://api.github.com/repos/${owner}/${repoName}/releases{/id}`,
        deployments_url: `https://api.github.com/repos/${owner}/${repoName}/deployments`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pushed_at: new Date().toISOString(),
        git_url: `git://github.com/${owner}/${repoName}.git`,
        ssh_url: `git@github.com:${owner}/${repoName}.git`,
        clone_url: `https://github.com/${owner}/${repoName}.git`,
        svn_url: `https://github.com/${owner}/${repoName}`,
        homepage: '',
        size: 1024,
        stargazers_count: 0,
        watchers_count: 0,
        language: 'Unknown',
        has_issues: true,
        has_projects: true,
        has_downloads: true,
        has_wiki: true,
        has_pages: false,
        has_discussions: false,
        forks_count: 0,
        mirror_url: null,
        archived: false,
        disabled: false,
        open_issues_count: 0,
        license: null,
        allow_forking: true,
        is_template: false,
        web_commit_signoff_required: false,
        topics: [],
        visibility: 'public',
        forks: 0,
        open_issues: 0,
        watchers: 0,
        default_branch: 'main'
      };

      setStatus('completed');
      eventTracker.trackEvent('legacy_indexer_completed', {
        repoUrl,
        repoName: indexedRepo.full_name
      });

      onComplete(indexedRepo);
      
    } catch (err) {
      console.error('Legacy indexing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to index repository');
      setStatus('error');
      eventTracker.trackEvent('legacy_indexer_error', {
        repoUrl,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.legacyContainer}>
      <div className={styles.legacyHeader}>
        <h3 className={styles.legacyTitle}>Legacy Repository Indexer</h3>
        <div className={styles.legacyWarning}>
          ⚠️ This is a legacy component that will be deprecated soon.
        </div>
      </div>

      <div className={styles.legacyContent}>
        <div className={styles.inputGroup}>
          <label htmlFor="repoUrl" className={styles.inputLabel}>
            GitHub Repository URL
          </label>
          <input
            id="repoUrl"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className={styles.inputField}
            disabled={loading}
          />
          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>

        <div className={styles.statusInfo}>
          {status === 'idle' && (
            <div className={styles.statusIdle}>
              Ready to index repository
            </div>
          )}

          {status === 'indexing' && (
            <div className={styles.statusIndexing}>
              <span className={styles.spinner}></span>
              Indexing repository... (Legacy process)
            </div>
          )}

          {status === 'completed' && (
            <div className={styles.statusCompleted}>
              ✅ Repository indexed successfully!
            </div>
          )}

          {status === 'error' && (
            <div className={styles.statusError}>
              ❌ Indexing failed. Please try again.
            </div>
          )}
        </div>

        <div className={styles.legacyNote}>
          <strong>Note:</strong> This legacy indexer uses the old API endpoints and may have limited functionality.
          Consider using the new repository selection modal for better performance and features.
        </div>
      </div>

      <div className={styles.buttonGroup}>
        <button
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>

        <button
          className={
            `${styles.indexButton} $
            ${loading || !repoUrl ? styles.indexButtonDisabled : ''}
            `
          }
          onClick={handleIndexRepository}
          disabled={loading || !repoUrl}
        >
          {loading ? (
            <>
              <span className={styles.buttonSpinner}></span>
              Indexing...
            </>
          ) : (
            'Index Repository (Legacy)'
          )}
        </button>
      </div>
    </div>
  );
};