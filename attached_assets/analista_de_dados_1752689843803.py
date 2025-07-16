import os
import re

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS

class Dados:
    def __init__(self, modelo: ChatOpenAI, vectorstore=None):
        self.nome = "analista_de_dados"
        self.modelo = modelo
        self.historico = []

        if vectorstore:
            self.vectorstore = vectorstore
        else:
            caminho_pdf = os.path.join("prompts", "frameworks", "analistadedados.pdf")
            loader = PyPDFLoader(caminho_pdf)
            documentos = loader.load()
            self.vectorstore = FAISS.from_documents(documentos, OpenAIEmbeddings())

    async def perguntar(self, mensagem: str) -> str:
        try:
            # Busca mais enxuta (k=2)
            contexto = self.vectorstore.similarity_search(mensagem, k=2)
            texto_contexto = "\n".join([doc.page_content for doc in contexto])

            partes = mensagem.strip().split("🔹 Pergunta específica do PO:")
            demanda = partes[0].strip()
            pergunta_po = partes[1].strip() if len(partes) > 1 else mensagem.strip()

            # Extrair o ID da pergunta, se houver
            id_match = re.search(r"\(ID:\s*(P\d+)\)", pergunta_po)
            id_pergunta = id_match.group(1) if id_match else "P?"

            mensagens = [
                SystemMessage(content="""\
Você é o Analista de Dados da squad Redeflex POS.

Responda apenas se a demanda envolver dados, indicadores, integrações, campos obrigatórios ou validações numéricas.

- Sempre inicie com "🔁 Respondendo à pergunta [ID]:"
- O ID estará no enunciado do PO como (ID: P4).

Estruture a resposta assim:

🔍 Campos e estruturas de dados
- Quais campos, formatos, obrigatoriedade?

🔄 Integrações
- Precisa buscar dados em outro sistema?

🧪 Validações e regras numéricas
- Limites, máscaras, regras de negócio?

📈 Indicadores e Métricas
- Algum indicador relevante?

⚠️ Riscos de dados
- Campo crítico? Precisa tratar ausência?

### Dúvidas Construtivas
1. [Apenas se houver dúvida relevante sobre dados.]

Evite explicações teóricas ou mock de dashboards.
"""),
                HumanMessage(content=f"""\
📘 Contexto de dados:
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
