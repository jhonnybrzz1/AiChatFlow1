import { cn } from "@/lib/utils";

export type MessageCategory = 'question' | 'answer' | 'alert' | 'error' | 'system';

interface CategoryConfig {
    color: string;
    borderColor: string;
    label: string;
    ariaLabel: string;
}

export const categoryConfig: Record<MessageCategory, CategoryConfig> = {
    question: {
        color: 'var(--accent-violet)',
        borderColor: 'var(--accent-violet)',
        label: 'PERGUNTA',
        ariaLabel: 'Mensagem de pergunta'
    },
    answer: {
        color: 'var(--accent-lime)',
        borderColor: 'var(--accent-lime)',
        label: 'RESPOSTA',
        ariaLabel: 'Mensagem de resposta'
    },
    alert: {
        color: 'var(--warning)',
        borderColor: 'var(--warning)',
        label: 'ALERTA',
        ariaLabel: 'Mensagem de alerta'
    },
    error: {
        color: 'var(--destructive)',
        borderColor: 'var(--destructive)',
        label: 'ERRO',
        ariaLabel: 'Mensagem de erro'
    },
    system: {
        color: 'var(--foreground-muted)',
        borderColor: 'var(--foreground-muted)',
        label: 'SISTEMA',
        ariaLabel: 'Mensagem do sistema'
    }
};

interface MessageCategoryBadgeProps {
    category: MessageCategory;
    className?: string;
}

export function MessageCategoryBadge({ category, className }: MessageCategoryBadgeProps) {
    const config = categoryConfig[category];

    return (
        <span
            className={cn(
                "brutal-badge font-mono",
                className
            )}
            style={{
                color: config.color,
                borderColor: config.color,
            }}
            role="status"
            aria-label={config.ariaLabel}
        >
            {config.label}
        </span>
    );
}
