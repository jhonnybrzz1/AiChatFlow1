import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { RefinementAgentMessageContent } from './refinement-agent-message-plain-text';
import './refinement-dialog.css';

interface RefinementDialogProps {
  agent: string;
  header: string;
  message: string;
  isOpen?: boolean;
  onClose: () => void;
  onApply: () => void;
  onReviewLater: () => void;
  onClarityFeedback?: (clarityValue: "yes" | "no") => void;
}

const agentClassMap: Record<string, string> = {
  qa: 'agent-qa',
  ux: 'agent-ux',
  pm: 'agent-pm',
  tech_lead: 'agent-tech-lead',
  product_owner: 'agent-po',
  scrum_master: 'agent-scrum',
  analista_de_dados: 'agent-analyst',
  refinador: 'agent-refinador',
  // Additional common names
  'tech-lead': 'agent-tech-lead',
  'product-manager': 'agent-pm',
  'scrum-master': 'agent-scrum',
  'data-analyst': 'agent-analyst',
  'analyst': 'agent-analyst',
  'enfp': 'agent-refinador',
  'intj': 'agent-analyst',
};

const RefinementDialog: React.FC<RefinementDialogProps> = ({
  agent,
  header,
  message,
  isOpen = false,
  onClose,
  onApply,
  onReviewLater,
  onClarityFeedback
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyEndRef = useRef<HTMLDivElement>(null);

  const agentClass = agentClassMap[agent] || 'agent-qa';

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow for animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    bodyEndRef.current?.scrollIntoView({ block: 'end' });
  }, [isOpen, message]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = ''; // Reset body scroll
    };
  }, [isOpen, onClose]);

  if (!isVisible && !isOpen) {
    return null;
  }

  return (
    <div
      className={`chat-refinement-box ${isOpen ? 'active' : ''} ${agentClass}`}
      role="dialog"
      aria-labelledby="refinement-dialog-header"
      aria-modal="true"
      aria-describedby="refinement-dialog-description"
    >
      <div
        className="dialog-content"
        ref={dialogRef}
        tabIndex={-1}
        aria-label={header}
      >
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="Fechar diálogo de refinamento"
        >
          <X size={20} />
          <span className="sr-only">Fechar</span>
        </button>

        <div
          className="header"
          id="refinement-dialog-header"
          tabIndex={0}
        >
          {header}
        </div>

        <div
          className="body"
          id="refinement-dialog-description"
        >
          <div className="dialog-chat-thread" tabIndex={0}>
            <div className="dialog-chat-bubble agent">
              <RefinementAgentMessageContent content={message} />
            </div>
            <div ref={bodyEndRef} />
          </div>
        </div>

        <div className="footer">
          {onClarityFeedback && (
            <div className="flex items-center gap-2 mr-auto">
              <span className="font-mono text-xs text-[var(--foreground-muted)]">
                Ficou claro?
              </span>
              <button
                className="btn btn-secondary"
                tabIndex={0}
                onClick={() => onClarityFeedback("yes")}
                aria-label="Marcar orientação como clara"
              >
                Sim
              </button>
              <button
                className="btn btn-secondary"
                tabIndex={0}
                onClick={() => onClarityFeedback("no")}
                aria-label="Marcar orientação como não clara"
              >
                Não
              </button>
            </div>
          )}
          <button
            className="btn btn-secondary"
            tabIndex={0}
            onClick={onReviewLater}
            aria-label="Adiar revisão do refinamento"
          >
            Revisar Depois
          </button>
          <button
            className="btn btn-primary"
            tabIndex={0}
            onClick={onApply}
            aria-label="Aplicar refinamento sugerido"
          >
            Aplicar Refinamento
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefinementDialog;
