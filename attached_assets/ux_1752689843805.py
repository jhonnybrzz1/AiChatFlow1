import os
import re

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader

class Ux:
    def __init__(self, modelo: ChatOpenAI, vectorstore=None):
        self.nome = "ux"
        self.modelo = modelo
        self.historico = []

        if vectorstore:
            self.vectorstore = vectorstore
        else:
            caminho_pdf = os.path.join("prompts", "frameworks", "manual_rfm.pdf")
            loader = PyPDFLoader(caminho_pdf)
            documentos = loader.load()
            self.vectorstore = FAISS.from_documents(documentos, OpenAIEmbeddings())

    async def perguntar(self, mensagem: str) -> str:
        try:
            contexto = self.vectorstore.similarity_search(mensagem, k=2)
            texto_contexto = "\n".join([doc.page_content for doc in contexto])

            # Separar partes da mensagem
            partes = mensagem.lower().split("demanda:")
            demanda = partes[1].split("❓ pergunta específica do po:")[0].strip() if len(partes) > 1 else mensagem.lower()
            pergunta_po = mensagem.strip().split("❓ Pergunta específica do PO:")[-1].strip()

            id_match = re.search(r"\(ID:\s*(P\d+)\)", pergunta_po)
            id_pergunta = id_match.group(1) if id_match else "P?"

            termos_tecnicos = [
                "api", "web service", "refatoração", "endpoint", "backend", "integração",
                "c#", "java", "serviço", "microserviço", "segurança", "log", "logs", "auditoria",
                "monitoramento", "infraestrutura", "performance", "manutenção", "tecnologia"
            ]
            termos_visuais = [
                "tela", "formulário", "usuário", "interface", "input", "botão",
                "feedback", "layout", "mensagem", "fluxo", "experiência", "interação"
            ]

            # Filtro técnico agressivo: ignora se não tiver nenhum termo visual
            if any(term in demanda for term in termos_tecnicos) and not any(term in demanda for term in termos_visuais):
                texto = (
                    "🎨 Esta demanda é estritamente técnica e não envolve interação com o usuário. "
                    "✅ Nenhuma análise de UX é necessária."
                )
                self.historico.append((mensagem, texto + " [Filtrada como técnica]"))
                return texto

            mensagens = [
                SystemMessage(content="""\
Você é o UX Designer da squad. Melhore a experiência do usuário com sugestões objetivas.
- Sempre inicie com "🔁 Respondendo à pergunta [ID]:"
- Só responda se envolver telas, fluxo ou interação.

Responda assim:
🧩 Pontos de fricção na jornada
🎨 Melhorias de interface (UI/UX)
♿ Acessibilidade
📋 Sugestão de fluxo ideal (se aplicável)

Evite repetir QA ou responder por obrigação. Só dúvidas relevantes ao final.
"""),
                HumanMessage(content=f"""\
📘 Contexto do manual:
{texto_contexto}

📌 Demanda recebida:
{demanda}

❓ Pergunta específica do PO:
{pergunta_po}
""")
            ]

            resposta = await self.modelo.agenerate([mensagens])
            texto = resposta.generations[0][0].text.strip()
            resposta_formatada = f"🔁 Respondendo à pergunta {id_pergunta}:\n\n{texto}"
            self.historico.append((mensagem, resposta_formatada))
            return resposta_formatada

        except Exception as e:
            return f"Erro ao responder: {e}"
