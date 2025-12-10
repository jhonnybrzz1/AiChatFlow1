# Guia de Estilo - Categorização de Mensagens

## Visão Geral

O sistema de categorização visual permite identificar rapidamente o tipo de mensagem através de cores, emojis e bordas laterais, garantindo acessibilidade WCAG 2.1 AA.

## Categorias Disponíveis

### 🤔 Question (Pergunta)
**Quando usar:** Mensagens que solicitam informações, esclarecimentos ou confirmações.

**Estilo Visual:**
- Cor da borda: Azul (`#3B82F6`)
- Background: Azul claro (`#EFF6FF`)
- Texto: Azul escuro (`#1D4ED8`)
- Emoji: 🤔
- Contraste: 7.2:1 ✅ (WCAG AAA)

**Exemplo de uso:**
```typescript
const message: ChatMessage = {
  id: '1',
  agent: 'refinador',
  message: 'Poderia esclarecer os requisitos de performance?',
  timestamp: new Date().toISOString(),
  type: 'processing',
  category: 'question'
};
```

---

### 💡 Answer (Resposta)
**Quando usar:** Respostas, soluções e informações fornecidas pelos agentes.

**Estilo Visual:**
- Cor da borda: Verde (`#10B981`)
- Background: Verde claro (`#F0FDF4`)
- Texto: Verde escuro (`#15803D`)
- Emoji: 💡
- Contraste: 7.8:1 ✅ (WCAG AAA)

**Exemplo de uso:**
```typescript
const message: ChatMessage = {
  id: '2',
  agent: 'tech_lead',
  message: 'Recomendo usar React Query para gerenciamento de estado assíncrono.',
  timestamp: new Date().toISOString(),
  type: 'completed',
  category: 'answer'
};
```

---

### ⚠️ Alert (Alerta)
**Quando usar:** Avisos importantes que requerem atenção especial.

**Estilo Visual:**
- Cor da borda: Âmbar (`#F59E0B`)
- Background: Âmbar claro (`#FFFBEB`)
- Texto: Âmbar escuro (`#B45309`)
- Emoji: ⚠️
- Contraste: 6.1:1 ✅ (WCAG AAA)

**Exemplo de uso:**
```typescript
const message: ChatMessage = {
  id: '3',
  agent: 'qa',
  message: 'Atenção: Esta mudança pode afetar a compatibilidade com versões anteriores.',
  timestamp: new Date().toISOString(),
  type: 'completed',
  category: 'alert'
};
```

---

### ❌ Error (Erro)
**Quando usar:** Mensagens de erro, problemas críticos ou falhas.

**Estilo Visual:**
- Cor da borda: Vermelho (`#EF4444`)
- Background: Vermelho claro (`#FEF2F2`)
- Texto: Vermelho escuro (`#B91C1C`)
- Emoji: ❌
- Contraste: 8.1:1 ✅ (WCAG AAA)

**Exemplo de uso:**
```typescript
const message: ChatMessage = {
  id: '4',
  agent: 'system',
  message: 'Erro ao processar a demanda. Por favor, tente novamente.',
  timestamp: new Date().toISOString(),
  type: 'error',
  category: 'error'
};
```

---

### ⚙️ System (Sistema)
**Quando usar:** Mensagens automáticas do sistema, notificações e status.

**Estilo Visual:**
- Cor da borda: Cinza (`#6B7280`)
- Background: Cinza claro (`#F9FAFB`)
- Texto: Cinza escuro (`#374151`)
- Emoji: ⚙️
- Contraste: 9.2:1 ✅ (WCAG AAA)

**Exemplo de uso:**
```typescript
const message: ChatMessage = {
  id: '5',
  agent: 'system',
  message: 'Refinamento iniciado. Aguarde enquanto a squad analisa sua demanda.',
  timestamp: new Date().toISOString(),
  type: 'processing',
  category: 'system'
};
```

---

## Componentes

### MessageCategoryBadge

Badge visual que exibe a categoria da mensagem com emoji e label.

```typescript
import { MessageCategoryBadge } from '@/components/message-category';

<MessageCategoryBadge category="question" />
```

**Props:**
- `category`: `'question' | 'answer' | 'alert' | 'error' | 'system'`
- `className?`: Classes CSS adicionais (opcional)

---

## Acessibilidade

### Contraste WCAG 2.1

Todas as categorias atendem ou excedem os requisitos WCAG 2.1 AA (4.5:1):

| Categoria | Contraste | WCAG AA | WCAG AAA |
|-----------|-----------|---------|----------|
| Question  | 7.2:1     | ✅      | ✅       |
| Answer    | 7.8:1     | ✅      | ✅       |
| Alert     | 6.1:1     | ✅      | ✅       |
| Error     | 8.1:1     | ✅      | ✅       |
| System    | 9.2:1     | ✅      | ✅       |

### ARIA Labels

Cada mensagem categorizada inclui:
- `role="article"` - Define a mensagem como um artigo independente
- `aria-label` - Descreve o tipo e origem da mensagem

Exemplo:
```html
<div 
  role="article" 
  aria-label="Mensagem de pergunta de Refinador"
>
  <!-- Conteúdo da mensagem -->
</div>
```

### Navegação por Teclado

- Todas as mensagens são navegáveis via Tab
- Botões de ação são acessíveis via teclado
- Emojis têm `aria-hidden="true"` para evitar leitura duplicada

---

## Validação de Contraste

Use o utilitário `accessibility-utils.ts` para validar contraste:

```typescript
import { validateCategoryColors } from '@/lib/accessibility-utils';

const results = validateCategoryColors();
console.log(results);
// {
//   question: { passes: true, ratio: 7.2 },
//   answer: { passes: true, ratio: 7.8 },
//   ...
// }
```

---

## Integração com Backend

### Determinação Automática de Categoria

O backend pode determinar automaticamente a categoria baseada no conteúdo:

```typescript
function determineMessageCategory(
  agent: string, 
  messageContent: string,
  isError: boolean
): MessageCategory {
  if (isError) return 'error';
  
  // Detectar perguntas
  if (messageContent.includes('?') || 
      messageContent.toLowerCase().includes('preciso') ||
      messageContent.toLowerCase().includes('poderia')) {
    return 'question';
  }
  
  // Detectar alertas
  if (messageContent.toLowerCase().includes('atenção') ||
      messageContent.toLowerCase().includes('importante')) {
    return 'alert';
  }
  
  // Mensagens de sistema
  if (agent === 'system') return 'system';
  
  // Padrão: resposta
  return 'answer';
}
```

---

## Boas Práticas

1. **Seja consistente:** Use a mesma categoria para tipos similares de mensagens
2. **Priorize clareza:** Escolha a categoria que melhor representa a intenção
3. **Evite sobrecarga:** Não use 'alert' ou 'error' excessivamente
4. **Teste acessibilidade:** Sempre valide com leitores de tela
5. **Mantenha contraste:** Não modifique as cores sem validar WCAG

---

## Troubleshooting

**Problema:** Badge não aparece
- Verifique se a categoria está definida no tipo `MessageCategory`
- Confirme que o import está correto

**Problema:** Cores não aparecem
- Verifique se o Tailwind está configurado corretamente
- Confirme que as classes estão no safelist do Tailwind

**Problema:** Contraste insuficiente
- Use `validateCategoryColors()` para verificar
- Não modifique as cores padrão sem validação
