// Repository Selector Component
// Wrapper component that decides which repository selection method to use

import React, { useState } from 'react';
import { RepositoryConfirmationModal } from './RepositoryConfirmationModal';
import { LegacyRepositoryIndexer } from '../../micro-frontends/legacy/LegacyRepositoryIndexer';
import { Repository } from '../../types/github';
import { eventTracker } from '../../services/eventTracker';
import styles from './RepositorySelector.module.css';

interface RepositorySelectorProps {
  onRepositorySelected: (repo: Repository) => void;
  onCancel: () => void;
  initialRepo?: Repository | null;
  demandId?: number;
  useLegacy?: boolean;
}

export const RepositorySelector: React.FC<RepositorySelectorProps> = ({
  onRepositorySelected,
  onCancel,
  initialRepo = null,
  demandId,
  useLegacy = false
}) => {
  const [showModal, setShowModal] = useState<boolean>(true);
  const [useLegacyFlow, setUseLegacyFlow] = useState<boolean>(useLegacy);

  const handleRepositorySelected = (repo: Repository) => {
    eventTracker.trackEvent('repository_selected_final', {
      repo: repo.full_name,
      repoId: repo.id,
      method: useLegacyFlow ? 'legacy' : 'modal',
      demandId
    });
    onRepositorySelected(repo);
    setShowModal(false);
  };

  const handleCancel = () => {
    eventTracker.trackEvent('repository_selection_cancelled', {
      method: useLegacyFlow ? 'legacy' : 'modal',
      demandId
    });
    onCancel();
    setShowModal(false);
  };

  const toggleMethod = () => {
    const newMethod = !useLegacyFlow;
    setUseLegacyFlow(newMethod);
    eventTracker.trackEvent('repository_selection_method_toggled', {
      from: useLegacyFlow ? 'legacy' : 'modal',
      to: newMethod ? 'legacy' : 'modal',
      demandId
    });
  };

  if (!showModal) return null;

  return (
    <div className={styles.selectorContainer}>
      {!useLegacyFlow ? (
        <RepositoryConfirmationModal
          isOpen={showModal}
          onClose={handleCancel}
          onConfirm={handleRepositorySelected}
          initialRepo={initialRepo}
          demandId={demandId}
        />
      ) : (
        <div className={styles.legacyWrapper}>
          <LegacyRepositoryIndexer
            onComplete={handleRepositorySelected}
            onCancel={handleCancel}
            initialRepo={initialRepo}
          />
        </div>
      )}

      <div className={styles.methodToggle}>
        <button 
          onClick={toggleMethod}
          className={styles.toggleButton}
          title={useLegacyFlow ? 'Switch to Modern Modal' : 'Switch to Legacy Indexer'}
        >
          {useLegacyFlow ? '🔄 Switch to Modern Modal' : '⚠️ Switch to Legacy Indexer'}
        </button>
      </div>
    </div>
  );
};