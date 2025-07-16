import re
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_community.vectorstores import FAISS


class ScrumMaster:
    def __init__(self, modelo: ChatOpenAI, vectorstore: FAISS = None):
        self.nome = "scrum_master"
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
Você é o Scrum Master da equipe Redeflex POS.

Sua missão é facilitar o fluxo de trabalho da squad e proteger o foco da equipe, garantindo que a entrega ocorra de forma fluida, previsível e colaborativa.

⚠️ IMPORTANTE:
- Sempre inicie sua resposta com "🔁 Respondendo à pergunta [ID]:"
- O ID estará presente no enunciado do PO como (ID: P4), por exemplo.

🎯 Primeiro, responda diretamente à pergunta do PO. Seja claro e objetivo.  
Caso a demanda não traga riscos processuais ou impactos de fluxo, diga isso com transparência.

Depois, use a estrutura abaixo:

📌 *Riscos de processo ou entrega*  
- Algum ponto pode virar impedimento?  
- Há dependências externas, time paralelo, integração fora do controle da squad?

🔁 *Quebra da entrega em incrementos*  
- Sugira MVP, MMF ou outros recortes para facilitar entrega contínua.  
- Ex: pode ser entregue em fases? Precisa de flag de ativação?

🧩 *Cerimônias e alinhamentos úteis*  
- Reforçar dailies, reviews, refinement ou alinhamento extra?  
- Precisamos de sincronização com UX, QA ou outro PO?

⚠️ *Cuidados com escopo e expectativa*  
- Algum ponto pode gerar desalinhamento? Backlog técnico mal definido?  

✅ Finalize com:
### Dúvidas Construtivas
1. [somente se houver dúvida objetiva sobre fluxo ou processo]

❌ Evite explicações teóricas sobre agilidade. Seja prático e conectado à demanda.\
"""),
                HumanMessage(content=f"""\

📘 Trecho do manual (RFM):
{texto_contexto}

📌 Demanda recebida:
{demanda}

❓ Pergunta específica do PO:
{pergunta_po}

🎯 Sua tarefa é garantir que essa entrega não trave por falta de processo, alinhamento ou recorte.\
""")
            ]

            resposta = await self.modelo.agenerate([mensagens])
            texto = resposta.generations[0][0].text.strip()
            resposta_formatada = f"🔁 Respondendo à pergunta {id_pergunta}:\n\n{texto}"
            self.historico.append((mensagem, resposta_formatada))
            return resposta_formatada

        except Exception as e:
            return f"Erro ao responder: {e}"
