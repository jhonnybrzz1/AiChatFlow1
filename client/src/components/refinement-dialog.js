/**
 * Refinement Dialog Utility Functions
 * Provides functionality for the refinement dialog with smooth animations and accessibility
 */

class RefinementDialog {
  constructor(dialogElement) {
    this.dialog = dialogElement;
    this.backdrop = this.createBackdrop();
    this.isOpen = false;
    this.animationFrameId = null;
    
    // Bind event listeners
    this.handleBackdropClick = this.handleBackdropClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleCloseButtonClick = this.handleCloseButtonClick.bind(this);
    this.handleApplyButton = this.handleApplyButton.bind(this);
    this.handleReviewLaterButton = this.handleReviewLaterButton.bind(this);
    
    this.setupEventListeners();
  }

  createBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.className = 'chat-refinement-box';
    backdrop.style.display = 'none';
    document.body.appendChild(backdrop);
    return backdrop;
  }

  setupEventListeners() {
    // Close button
    const closeButton = this.dialog.querySelector('.dialog-close');
    if (closeButton) {
      closeButton.addEventListener('click', this.handleCloseButtonClick);
    }

    // Apply button
    const applyButton = this.dialog.querySelector('.btn-primary');
    if (applyButton) {
      applyButton.addEventListener('click', this.handleApplyButton);
    }

    // Review later button
    const reviewButton = this.dialog.querySelector('.btn-secondary');
    if (reviewButton) {
      reviewButton.addEventListener('click', this.handleReviewLaterButton);
    }
  }

  handleBackdropClick(event) {
    if (event.target === this.backdrop) {
      this.close();
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  handleCloseButtonClick() {
    this.close();
  }

  handleApplyButton() {
    // Trigger custom event for apply action
    this.dialog.dispatchEvent(new CustomEvent('applyRefinement', { 
      bubbles: true,
      detail: { agent: this.dialog.dataset.agent }
    }));
  }

  handleReviewLaterButton() {
    // Trigger custom event for review later action
    this.dialog.dispatchEvent(new CustomEvent('reviewLater', { 
      bubbles: true,
      detail: { agent: this.dialog.dataset.agent }
    }));
  }

  open() {
    if (this.isOpen) return;

    // Add to DOM if not already there
    if (!document.contains(this.backdrop)) {
      document.body.appendChild(this.backdrop);
    }

    this.isOpen = true;
    this.backdrop.style.display = 'flex';
    
    // Trigger animation using requestAnimationFrame
    this.animationFrameId = requestAnimationFrame(() => {
      this.backdrop.classList.add('active');
      
      // Focus the dialog for accessibility
      const firstFocusable = this.dialog.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) {
        (firstFocusable as HTMLElement).focus();
      }
    });

    // Add event listeners
    this.backdrop.addEventListener('click', this.handleBackdropClick);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.backdrop.classList.remove('active');
    
    // Remove event listeners
    this.backdrop.removeEventListener('click', this.handleBackdropClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (this.backdrop && this.backdrop.parentNode) {
        this.backdrop.parentNode.removeChild(this.backdrop);
      }
    }, 300);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.close();
    
    // Remove references
    this.dialog = null;
    this.backdrop = null;
  }
}

// Export for use in other modules
export { RefinementDialog };

/**
 * Utility function to initialize all refinement dialogs on a page
 */
export function initializeRefinementDialogs() {
  const dialogs = document.querySelectorAll('.chat-refinement-box');
  
  dialogs.forEach(dialog => {
    const refinementDialog = new RefinementDialog(dialog);
    
    // Store instance on element for later access
    dialog.refinementDialog = refinementDialog;
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRefinementDialogs);
} else {
  initializeRefinementDialogs();
}