import os
import re
import random
import difflib

from langchain_core.messages import SystemMessage, HumanMessage

class Refinador:
    def __init__(self, modelo, agentes: dict, vectorstore_rfm, vectorstore_completo):
        self.nome = "refinador"
        self.modelo = modelo
        self.agentes = agentes
        self.vectorstore_rfm = vectorstore_rfm
        self.vectorstore_completo = vectorstore_completo
        self.ultima_pergunta = ""
        self.ultima_resposta = ""
        self.historico_rodadas = []
        self.respostas_po = []
        self.introducao_exibida = False
        self.contador_perguntas = 1  # ID incremental para cada pergunta

    def _pergunta_ja_feita(self, pergunta_atual: str) -> bool:
        perguntas_previas = []
        for rodada in self.historico_rodadas:
            perguntas_previas.extend(re.findall(r"\*\*(\w+)\*\*: (.+)", rodada))
        perguntas_texto = [pergunta.strip().lower() for _, pergunta in perguntas_previas]
        similares = difflib.get_close_matches(pergunta_atual.lower(), perguntas_texto, cutoff=0.92)
        return len(similares) > 0

    def _avaliar_escopo_demanda(self, texto: str) -> dict:
        texto = texto.lower()
        termos_visuais = ["tela", "formulário", "interface", "input", "botão", "layout", "mensagem"]
        envolve_visual = any(t in texto for t in termos_visuais)
        envolve_ux = envolve_visual
        envolve_dados = any(t in texto for t in ["indicador", "kpi", "dashboard", "relatório", "métrica"])
        envolve_qa = any(t in texto for t in ["validação", "erro", "mensagem de erro", "teste", "comportamento inesperado"])
        envolve_scrum = True

        return {
            "ux": envolve_ux,
            "analista_de_dados": envolve_dados,
            "qa": envolve_qa,
            "scrum_master": envolve_scrum
        }

    async def perguntar(self, pergunta: str, respostas_anteriores: list = None, fase: str = "problema_e_impacto", agentes_filtrados: list = None) -> dict:
        self.ultima_pergunta = pergunta.strip()
        escopo = self._avaliar_escopo_demanda(pergunta)

        blocos_agentes = []
        for chave in self.agentes.keys():
            if agentes_filtrados is not None:
                if chave in agentes_filtrados:
                    blocos_agentes.append(f"**{chave}**: [pergunta]")
            elif escopo.get(chave, False):
                blocos_agentes.append(f"**{chave}**: [pergunta]")

        formato_exigido = "\n".join(blocos_agentes)
        vectorstore = self.vectorstore_rfm if "rfm" in pergunta.lower() else self.vectorstore_completo
        contexto = vectorstore.similarity_search(pergunta, k=2)
        texto_contexto = "\n".join([doc.page_content for doc in contexto])

        respostas_texto = ""
        if respostas_anteriores:
            for i, rodada in enumerate(respostas_anteriores):
                respostas_texto += f"\nRodada {i + 1}:\n"
                for agente, resposta in rodada.items():
                    respostas_texto += f"\n🧠 {agente.upper()} respondeu ao PO:\n{resposta.strip()}\n"

        # Limita respostas do PO às 2 últimas rodadas (economia de tokens)
        respostas_po_texto = "\n\n".join(self.respostas_po[-2:])

        abertura_variadas = [
            "Bora aprofundar mais, galera.",
            "Ainda não estou satisfeito com o que temos.",
            "Vamos elevar o nível dessa entrega.",
            "Quero mais ousadia e foco em impacto.",
            "Seguimos? Quero mais provocação nessa rodada."
        ]

        introducao_po = "Vamos abrir o refinamento com base na seguinte demanda."
        if self.introducao_exibida:
            introducao_po = random.choice(abertura_variadas)
        self.introducao_exibida = True

        foco_fase = {
            "problema_e_impacto": "problema que a demanda busca resolver, impacto na operação e usuários",
            "fluxo_e_regras": "etapas do processo atual, regras de negócio envolvidas e mudanças esperadas",
            "validacoes_e_dados": "validações necessárias, integrações com dados, campos obrigatórios e formatos",
            "testes_e_criterios": "critérios de aceite, métricas de sucesso, testes esperados e condições de conclusão"
        }.get(fase, "")

        instrucao_po = f"""
Você é o Product Owner da squad virtual (perfil ENTP).
Gere perguntas estratégicas, provocativas e específicas para cada agente.
Baseie-se:
- Na demanda recebida;
- Nas respostas anteriores da squad;
- No contexto dos manuais.

Nesta rodada, o foco do refinamento deve ser: {foco_fase.upper()}.

Nunca traga pareceres finais; só perguntas.
Formato obrigatório:
{formato_exigido}
""".strip()

        mensagens = [
            SystemMessage(content=instrucao_po),
            HumanMessage(content=f"""
🔹 Contexto dos manuais:
{texto_contexto}

🔹 Demanda recebida:
{pergunta.strip()}

🔹 Respostas anteriores dos agentes:
{respostas_texto.strip()}

🔹 Suas últimas perguntas como PO:
{respostas_po_texto.strip()}
""")
        ]

        resposta = await self.modelo.agenerate([mensagens])
        texto = resposta.generations[0][0].text.strip()

        perguntas_limpa = re.findall(r"\*\*(\w+)\*\*: (.+)", texto)
        perguntas_limpa = [(a, p) for a, p in perguntas_limpa if a.strip().lower() in self.agentes]

        self.ultima_resposta = "\n".join([f"**{agente}**: {pergunta}" for agente, pergunta in perguntas_limpa])

        print("\n🗣️ Conversa do PO com a squad:\n")
        for item in self.ultima_resposta.split("\n"):
            print(f"\n{item.strip()}\n" + "-" * 60)

        self.respostas_po.append(self.ultima_resposta)

        perguntas_filtradas = []
        for nome_agente, pergunta_individual in perguntas_limpa:
            if not self._pergunta_ja_feita(pergunta_individual):
                perguntas_filtradas.append((nome_agente, pergunta_individual))

        respostas_agentes = {}
        for nome_agente, pergunta_individual in perguntas_filtradas:
            chave = nome_agente.strip().lower()
            agente = self.agentes[chave]
            id_pergunta = f"P{self.contador_perguntas}"
            self.contador_perguntas += 1

            print(f"\n🔄 PO para {chave}: {pergunta_individual.strip()}")

            mensagem_formatada = f"""
Você está colaborando com o PO no refinamento da seguinte demanda:
\"{self.ultima_pergunta.strip()}\".

🔹 Pergunta específica do PO (ID: {id_pergunta}):
\"{pergunta_individual.strip()}\"
"""
            resposta_agente = await agente.perguntar(mensagem_formatada)

            if resposta_agente.strip().startswith("⚠️ Esta demanda "):
                continue

            respostas_agentes[chave] = f"🔁 Respondendo à pergunta {id_pergunta}:\n{resposta_agente.strip()}"

        self.historico_rodadas.append(self.ultima_resposta)
        return respostas_agentes

    def get_prompt(self) -> str:
        return "Prompt estratégico baseado em frameworks de produto e no manual RFM. Geração de perguntas específicas para cada agente conforme escopo da demanda."

    async def responder_duvidas(self, duvidas: list[str]) -> str:
        respostas_formatadas = []
        for i, duvida in enumerate(duvidas, start=1):
            if "ux" in duvida.lower():
                continue

            contexto = self.vectorstore_completo.similarity_search(duvida, k=2)
            texto_contexto = "\n".join([doc.page_content for doc in contexto])

            mensagens = [
                SystemMessage(content="Você é o Product Owner responsável por esclarecer dúvidas levantadas pela squad durante o refinamento de uma demanda. Seja direto e breve."),
                HumanMessage(content=f"""
🔸 Dúvida levantada:
{duvida}

🔹 Contexto extraído dos documentos:
{texto_contexto}
""")
            ]

            resposta = await self.modelo.agenerate([mensagens])
            texto = resposta.generations[0][0].text.strip()

            resposta_formatada = f"📎 Dúvida {i}:\n{texto}\n" + "-" * 60
            respostas_formatadas.append(resposta_formatada)

        return "\n\n".join(respostas_formatadas)

    async def responder_interagentes(self, respostas_rodada: dict) -> str:
        return ""
