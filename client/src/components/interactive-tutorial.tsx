import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface InteractiveTutorialProps {
    run?: boolean;
    onFinish?: () => void;
}

export function InteractiveTutorial({ run = false, onFinish }: InteractiveTutorialProps) {
    const [runTour, setRunTour] = useState(run);

    useEffect(() => {
        setRunTour(run);
    }, [run]);

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div>
                    <h2 className="text-lg font-bold mb-2">Bem-vindo ao AIChatFlow! 🎉</h2>
                    <p>Vamos fazer um tour rápido pelas novas funcionalidades.</p>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="github-import"]',
            content: (
                <div>
                    <h3 className="font-bold mb-2">🔗 GitHub Import</h3>
                    <p>Importe repositórios do GitHub diretamente para criar demandas contextualizadas.</p>
                </div>
            ),
            placement: 'bottom',
        },
        {
            target: '[data-tour="demand-type"]',
            content: (
                <div>
                    <h3 className="font-bold mb-2">📋 Tipo de Demanda</h3>
                    <p>Selecione o tipo usando as tabs modernas. Cada tipo tem seu próprio ícone.</p>
                </div>
            ),
            placement: 'bottom',
        },
        {
            target: '[data-tour="file-upload"]',
            content: (
                <div>
                    <h3 className="font-bold mb-2">📎 Anexar Documentos</h3>
                    <p>Arraste arquivos ou clique para anexar. Use o botão X para remover anexos individuais.</p>
                </div>
            ),
            placement: 'top',
        },
        {
            target: '[data-tour="history-sidebar"]',
            content: (
                <div>
                    <h3 className="font-bold mb-2">📜 Histórico</h3>
                    <p className="mb-2">Em mobile, o histórico vira um drawer lateral para economizar espaço.</p>
                    <p className="text-sm text-muted-foreground">Clique em qualquer demanda para ver os detalhes.</p>
                </div>
            ),
            placement: 'left',
        },
        {
            target: '[data-chat-area]',
            content: (
                <div>
                    <h3 className="font-bold mb-2">💬 Área de Chat</h3>
                    <p className="mb-2">Acompanhe o refinamento em tempo real aqui.</p>
                    <p className="text-sm text-muted-foreground">O chat rola automaticamente para a última mensagem.</p>
                </div>
            ),
            placement: 'top',
        },
        {
            target: 'body',
            content: (
                <div>
                    <h2 className="text-lg font-bold mb-2">✨ Pronto!</h2>
                    <p className="mb-2">Você está pronto para usar todas as novas funcionalidades.</p>
                    <p className="text-sm text-muted-foreground">Dica: O formulário minimiza automaticamente após enviar uma demanda.</p>
                </div>
            ),
            placement: 'center',
        },
    ];

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRunTour(false);
            onFinish?.();
        }
    };

    return (
        <Joyride
            steps={steps}
            run={runTour}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: 'hsl(var(--primary))',
                    textColor: 'hsl(var(--foreground))',
                    backgroundColor: 'hsl(var(--background))',
                    arrowColor: 'hsl(var(--background))',
                    overlayColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: 8,
                    padding: 20,
                },
                buttonNext: {
                    backgroundColor: 'hsl(var(--primary))',
                    borderRadius: 6,
                    padding: '8px 16px',
                },
                buttonBack: {
                    color: 'hsl(var(--muted-foreground))',
                    marginRight: 10,
                },
                buttonSkip: {
                    color: 'hsl(var(--muted-foreground))',
                },
            }}
            locale={{
                back: 'Voltar',
                close: 'Fechar',
                last: 'Finalizar',
                next: 'Próximo',
                skip: 'Pular',
            }}
        />
    );
}
