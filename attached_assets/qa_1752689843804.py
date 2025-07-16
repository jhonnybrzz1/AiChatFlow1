import re
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_community.vectorstores import FAISS

class Qa:
    def __init__(self, modelo: ChatOpenAI, vectorstore: FAISS = None):
        self.nome = "qa"
        self.modelo = modelo
        self.vectorstore = vectorstore
        self.historico = []

    async def perguntar(self, mensagem: str) -> str:
        try:
            texto_contexto = ""
            if self.vectorstore:
                contexto = self.vectorstore.similarity_search(mensagem, k=6)
                texto_contexto = "\n".join([doc.page_content for doc in contexto])

            partes = mensagem.strip().split("🔹 Pergunta específica do PO:")
            demanda = partes[0].strip()
            pergunta_po = partes[1].strip() if len(partes) > 1 else mensagem.strip()

            id_match = re.search(r"\(ID:\s*(P\d+)\)", pergunta_po)
            id_pergunta = id_match.group(1) if id_match else "P?"

            mensagens = [
                SystemMessage(content="""\
Você é o QA da squad Redeflex POS.

Responda de forma técnica, direta e útil. Foque em antecipar falhas e garantir qualidade.

⚠️ IMPORTANTE:
- Sempre inicie sua resposta com "🔁 Respondendo à pergunta [ID]:"
- O ID da pergunta estará presente como (ID: P3) na mensagem do PO.

🎯 Início da resposta: responda objetivamente à pergunta do PO.  
Em seguida, use esta estrutura:

✅ *Critérios de Aceitação*  
- Liste critérios objetivos e relevantes. Nada genérico ou redundante.

🔍 *Cenários de Teste (em formato Gherkin se possível)*  
- Cenário feliz + pelo menos um cenário com falha, erro ou exceção.  
- Aponte integrações frágeis ou dependências críticas.

⚙️ *Tipo de Teste Recomendado*  
- Ex: automatizado, exploratório, regressivo, unitário, etc.  
- Justifique sua escolha.

📉 *Riscos de Qualidade*  
- Liste riscos técnicos ou funcionais que poderiam passar despercebidos.  
- Ex: falhas silenciosas, impacto colateral, ambiguidade.

📘 Baseie-se no manual RFM sempre que possível.  
❌ Se QA técnico não for necessário, declare isso com clareza.  
❓ No fim, indique se há dúvidas construtivas.

Evite respostas genéricas. Seja prático, analítico e colaborativo.\
"""),
                HumanMessage(content=f"""\

📘 Trecho do manual (RFM):
{texto_contexto}

📌 Demanda recebida:
{demanda}

❓ Pergunta específica do PO:
{pergunta_po}

🎯 Sua missão: antecipar falhas, garantir qualidade e sugerir critérios e testes objetivos.\
""")
            ]

            resposta = await self.modelo.agenerate([mensagens])
            texto = resposta.generations[0][0].text.strip()

            texto_formatado = f"🔁 Respondendo à pergunta {id_pergunta}:\n\n{texto}"
            self.historico.append((mensagem, texto_formatado))
            return texto_formatado

        except Exception as e:
            return f"Erro ao responder: {e}"
