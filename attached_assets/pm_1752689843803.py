import os
import re
import difflib
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

class Pm:
    def __init__(self, modelo: ChatOpenAI):
        self.nome = "pm"
        self.modelo = modelo
        self.historico = []

    async def perguntar(self, mensagem: str) -> str:
        try:
            mensagens = [
                SystemMessage(content="Você é um Product Manager experiente. Responda de forma direta, objetiva e sem repetir padrões anteriores. Use somente o conteúdo da mensagem atual, sem considerar interações passadas."),
                HumanMessage(content=mensagem.strip())
            ]
            resposta = await self.modelo.agenerate([mensagens])
            texto = resposta.generations[0][0].text.strip().lower()
            self.historico.append((mensagem, texto))
            return texto if texto in ["continuar", "finalizar"] else "finalizar"
        except Exception as e:
            return f"Erro ao responder: {e}"

    def _respostas_saturadas(self, respostas_rodada, rodada):
        if rodada < 2:
            return False
        texto_atual = "\n".join([res.strip() for res in respostas_rodada.values()])
        texto_anterior = "\n".join([res.strip() for res in self.historico[-1][1].values()]) if self.historico and isinstance(self.historico[-1][1], dict) else ""
        similaridade = difflib.SequenceMatcher(None, texto_atual, texto_anterior).ratio()
        return similaridade >= 0.92

    async def validar_e_reformular_demanda(self, demanda_bruta: str) -> str:
        prompt = f"""Você é um Product Manager estratégico. Reformule a demanda original para torná-la funcional e clara.

Texto original:
{demanda_bruta}

Ajuste a linguagem para torná-la mais objetiva e alinhada a times técnicos. Destaque o problema, impacto, escopo e proposta funcional."""
        mensagens = [
            SystemMessage(content="Você é um PM estratégico. Estruture, reformule e clareie a demanda original com contexto de produto."),
            HumanMessage(content=prompt.strip())
        ]
        resposta = await self.modelo.agenerate([mensagens])
        return resposta.generations[0][0].text.strip()

    async def avaliar_respostas(self, respostas_rodada, rodada):
        if self._respostas_saturadas(respostas_rodada, rodada):
            print("🔁 Respostas similares demais à rodada anterior. Refinamento encerrado.")
            return "finalizar"

        respostas_texto = "\n".join([
            f"{agente}:\n{resposta}\n" for agente, resposta in respostas_rodada.items()
        ])
        prompt = "Com base nas respostas da rodada atual, avalie se ainda há novas informações úteis ou se o refinamento pode ser encerrado. Responda com 'continuar' ou 'finalizar'."
        return await self.perguntar(prompt + "\n\n📄 Respostas:\n" + respostas_texto)

    async def gerar_prd(self, demanda_bruta, respostas, parecer_techlead):
        prompt = """Você é um PM responsável por gerar o PRD final a partir da demanda e das contribuições da squad.

Gere um documento estruturado com os seguintes blocos:

1. Visão Geral do Produto
2. Cenário Atual (Problema)
3. Solução Proposta
4. Requisitos Funcionais
5. Casos de Uso
6. Fluxo de Funcionamento
7. Validações
8. Dependências
9. Resultados Esperados
10. Métricas de Sucesso
11. Notas Técnicas do Time (resumo das contribuições dos agentes)

Se não houver conteúdo suficiente para algum bloco, indique 'N/A'."""
        contexto = f"📥 Demanda original enviada pelo solicitante:\n{demanda_bruta.strip()}\n\n"
        contexto += "\n📊 Respostas das rodadas de refinamento:\n"
        for i, rodada in enumerate(respostas):
            contexto += f"\n🔄 Rodada {i + 1}:\n"
            for agente, resposta in rodada.items():
                contexto += f"{agente.upper()}:\n{resposta.strip()}\n"
        if parecer_techlead:
            contexto += f"\n👨‍💻 Parecer Técnico do Tech Lead:\n{parecer_techlead.strip()}"

        mensagens = [
            SystemMessage(content=prompt.strip()),
            HumanMessage(content=contexto.strip())
        ]
        resposta = await self.modelo.agenerate([mensagens])
        return resposta.generations[0][0].text.strip()

    async def gerar_tasks(self, respostas_acumuladas, parecer_techlead):
        prompt = """Você é um Product Manager sênior responsável por transformar a demanda, as respostas dos agentes da squad e o parecer do Tech Lead em um conjunto de User Stories e Tasks claras, objetivas e bem estruturadas.

Seu objetivo é gerar uma lista de cards organizados em **Backend (🔧)** e **Frontend (🎨)**, cada um identificado pelo ícone correspondente no início da task.

### Instruções obrigatórias:
- Estruture as tasks por área (Backend e Frontend), usando os ícones 🔧 e 🎨 antes de cada linha.
- Cards Backend devem abordar lógica, APIs, integrações, regras de negócio, persistência e validações servidor.
- Cards Frontend devem cobrir telas, UX, navegação, formulários, componentes, validação client-side, visual e interação.
- Para cada User Story, traga tasks práticas e acionáveis, mas **evite granularizar demais**.
- Sempre que possível, associe **critérios de aceite** no final de cada grupo de cards (em bullet points).
- Limite-se a no máximo 10 cards por demanda.
- Use o formato:
###
User Story
Como [tipo de usuário], quero [ação] para [objetivo].

#### 🔧 Backend
- [ ] 🔧 Task 1
- [ ] 🔧 Task 2

#### 🎨 Frontend
- [ ] 🎨 Task 3
- [ ] 🎨 Task 4

#### Critérios de Aceite
- Critério 1
- Critério 2

Considere **apenas o contexto abaixo** (não use interações anteriores):

\"\"\" 
{CONTEXT}
\"\"\"

Não explique, apenas gere as User Stories e a lista de tasks com os ícones e estrutura indicados.
"""
        contexto = "\n\n".join([
            f"Rodada {i + 1}:\n" + "\n".join([f"{agente}: {resposta}" for agente, resposta in rodada.items()])
            for i, rodada in enumerate(respostas_acumuladas)
        ])
        if parecer_techlead:
            contexto += f"\n\nParecer Técnico:\n{parecer_techlead}"

        mensagens = [
            SystemMessage(content=prompt.replace("{CONTEXT}", contexto).strip()),
            HumanMessage(content="")
        ]
        resposta = await self.modelo.agenerate([mensagens])
        return resposta.generations[0][0].text.strip()

    async def enviar_emails(self, id_demanda, corpo_jhow, email_solicitante):
        try:
            import win32com.client as win32
            outlook = win32.Dispatch("Outlook.Application")

            mail_jhow = outlook.CreateItem(0)
            mail_jhow.To = "jose.azevedo@redeflex.com.br"
            mail_jhow.Subject = f"📌 Novo PRD Gerado - ID {id_demanda}"
            mail_jhow.Body = corpo_jhow

            pasta_doc = os.path.join("documentos")
            prd = os.path.join(pasta_doc, f"PRD_{id_demanda}.docx")
            tasks = os.path.join(pasta_doc, f"Tasks_{id_demanda}.docx")

            if os.path.exists(prd):
                mail_jhow.Attachments.Add(prd)
            if os.path.exists(tasks):
                mail_jhow.Attachments.Add(tasks)

            mail_jhow.Send()

            mail_user = outlook.CreateItem(0)
            mail_user.To = email_solicitante
            mail_user.Subject = f"📬 Demanda recebida - ID {id_demanda}"
            mail_user.Body = "Olá! Sua solicitação foi registrada e está em análise pela equipe de produto. Entraremos em contato em breve."
            mail_user.Send()

            print(f"📧 E-mails enviados com sucesso para você e para {email_solicitante}.")
        except Exception as e:
            print(f"❌ Erro ao enviar e-mails: {e}")
