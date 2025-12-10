import { cn } from "@/lib/utils";

export type MessageCategory = 'question' | 'answer' | 'alert' | 'error' | 'system';

interface CategoryConfig {
    color: string;
    borderColor: string;
    bgColor: string;
    emoji: string;
    label: string;
    ariaLabel: string;
}

export const categoryConfig: Record<MessageCategory, CategoryConfig> = {
    question: {
        color: 'text-blue-700',
        borderColor: 'border-l-blue-500',
        bgColor: 'bg-blue-50',
        emoji: '🤔',
        label: 'Pergunta',
        ariaLabel: 'Mensagem de pergunta'
    },
    answer: {
        color: 'text-green-700',
        borderColor: 'border-l-green-500',
        bgColor: 'bg-green-50',
        emoji: '💡',
        label: 'Resposta',
        ariaLabel: 'Mensagem de resposta'
    },
    alert: {
        color: 'text-amber-700',
        borderColor: 'border-l-amber-500',
        bgColor: 'bg-amber-50',
        emoji: '⚠️',
        label: 'Alerta',
        ariaLabel: 'Mensagem de alerta'
    },
    error: {
        color: 'text-red-700',
        borderColor: 'border-l-red-500',
        bgColor: 'bg-red-50',
        emoji: '❌',
        label: 'Erro',
        ariaLabel: 'Mensagem de erro'
    },
    system: {
        color: 'text-gray-700',
        borderColor: 'border-l-gray-500',
        bgColor: 'bg-gray-50',
        emoji: '⚙️',
        label: 'Sistema',
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
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                config.color,
                config.bgColor,
                className
            )}
            role="status"
            aria-label={config.ariaLabel}
        >
            <span aria-hidden="true">{config.emoji}</span>
            <span>{config.label}</span>
        </span>
    );
}
