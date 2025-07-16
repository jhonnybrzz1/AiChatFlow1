import os
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS

class TechLead:
    def __init__(self, modelo, vectorstore=None):
        self.nome = "tech_lead"
        self.modelo = modelo
        self.historico = []

        if vectorstore:
            self.vectorstore = vectorstore
        else:
            caminho_pdf = os.path.join("prompts", "frameworks", "documentacao_onboarding_rfm.pdf")
            loader = PyPDFLoader(caminho_pdf)
            documentos = loader.load()
            self.vectorstore = FAISS.from_documents(documentos, OpenAIEmbeddings())

        self.prompt_base = (
            "Você é o Tech Lead da squad. Analise viabilidade técnica, proponha arquitetura, aponte riscos e garanta alinhamento com boas práticas."
        )

    async def perguntar(self, pergunta):
        contexto = self.vectorstore.similarity_search(pergunta, k=2)
        texto_contexto = "\n".join([doc.page_content for doc in contexto])

        mensagens = [
            SystemMessage(content=self.prompt_base.strip() + "\n" + texto_contexto),
            HumanMessage(content=pergunta.strip())
        ]
        try:
            resposta = await self.modelo.agenerate([mensagens])
            texto = resposta.generations[0][0].text.strip()
            if not texto:
                texto = "Nenhuma resposta recebida."
            self.historico.append((pergunta, texto))
            return texto
        except Exception as e:
            return f"Erro ao responder: {e}"

    async def avaliar(self, demanda, respostas):
        respostas_formatadas = []
        for rodada in respostas:
            if isinstance(rodada, dict):
                for agente, resposta in rodada.items():
                    respostas_formatadas.append(f"[{agente}]: {resposta}")
            else:
                respostas_formatadas.append(str(rodada))
        respostas_texto = "\n\n".join(respostas_formatadas)

        prompt = f"""
Avalie tecnicamente a demanda abaixo e produza um parecer objetivo com estes blocos:
🧪 Viabilidade Técnica
🔧 Arquitetura Sugerida
🛠 Tecnologias
⚠️ Riscos Técnicos
🔐 Segurança
📈 Escalabilidade
🌐 Integrações Externas
🎚 Feature Flag
↩️ Rollback
🧠 Observações Finais

🔹 Demanda:
{demanda.strip()}

Rodadas de Refinamento:
{respostas_texto}
"""
        return await self.perguntar(prompt)

    async def gerar_mock_html(self, descricao_funcional: str) -> str:
        prompt = f"""
Gere um HTML simples com base na descrição abaixo (sem foco em design):

🔹 Descrição funcional:
{descricao_funcional.strip()}

Regras:
- Estrutura básica (form, input, button, etc)
- Sem frameworks CSS
- Só os campos/labels/botões/mensagens da descrição.
"""
        return await self.perguntar(prompt)
