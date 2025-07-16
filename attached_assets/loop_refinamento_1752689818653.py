import os
import re
import difflib
import tiktoken
from dotenv import load_dotenv
from colorama import Fore

from utils.documentos import salvar_prd, salvar_tasks
from utils.log_refinamento import salvar_log_refinamento

from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS

load_dotenv()

# ————————————————————————
# Otimização: carregar FAISS já salvo, não regere embeddings!
VECTOR_PATH_RFM = "dados/faiss_rfm"
VECTOR_PATH_FRAMEWORKS = "dados/faiss_completo"

def carregar_ou_criar_vectorstore(path, pdf_path, filtro=None):
    if os.path.exists(path):
        return FAISS.load_local(
            path, OpenAIEmbeddings(), allow_dangerous_deserialization=True
        )
    print(f"🔁 Gerando vetor para {pdf_path} pela primeira vez...")
    loader = PyPDFLoader(pdf_path)
    documentos = loader.load()
    if filtro:
        documentos = [doc for doc in documentos if filtro(doc)]
    os.makedirs("dados", exist_ok=True)
    vectorstore = FAISS.from_documents(documentos, OpenAIEmbeddings())
    vectorstore.save_local(path)
    return vectorstore

rfm_vectorstore = carregar_ou_criar_vectorstore(
    VECTOR_PATH_RFM,
    "prompts/frameworks/manual_rfm.pdf",
    filtro=lambda doc: any(p in doc.page_content.lower() for p in ["cadastro", "estoque", "venda", "login"])
)
vectorstore_completo = carregar_ou_criar_vectorstore(
    VECTOR_PATH_FRAMEWORKS,
    "prompts/frameworks/frameworks_produto.pdf"
)

def carregar_vectores():
    return rfm_vectorstore, vectorstore_completo

# ————————————————————————
# Auxiliares

def normalizar_nome(nome):
    return nome.strip().lower().replace(" ", "_")

def extrair_duvidas(respostas):
    duvidas = []
    for agente, resposta in respostas.items():
        blocos = re.findall(
            r"### Dúvidas Construtivas(.*?)(?:###|$)",
            resposta, re.DOTALL | re.IGNORECASE
        )
        for bloco in blocos:
            for linha in bloco.strip().splitlines():
                texto = linha.strip("•*- ").strip()
                if texto:
                    duvidas.append((agente, texto))
    return duvidas

def contar_tokens(texto, modelo="gpt-4o"):
    encoding = tiktoken.encoding_for_model(modelo)
    return len(encoding.encode(texto))

def respostas_redundantes(r1, r2, threshold=0.8):
    total, similares = 0, 0
    for agente in r1:
        if agente in r2:
            a1 = r1[agente].strip().lower()
            a2 = r2[agente].strip().lower()
            if not a1 or not a2:
                continue
            total += 1
            if difflib.SequenceMatcher(None, a1, a2).ratio() >= threshold:
                similares += 1
    return total > 0 and (similares / total) >= threshold

AGENTE_ICONE = {
    "analista_de_dados": "📈",
    "qa": "✅",
    "scrum_master": "🧝",
    "ux": "🎨",
    "tech_lead": "💧",
    "pm": "📋",
    "refinador": "🧠"
}

# ————————————————————————
# Otimização: Sumarizador de histórico por rodada

async def sumarizar_historico(respostas_acumuladas, modelo, agente_nome, limite=2):
    # Só mantém as últimas N respostas de outros agentes, resume se necessário
    respostas = []
    for rodada in respostas_acumuladas[-limite:]:
        for ag, r in rodada.items():
            if ag != agente_nome and r.strip():
                respostas.append(f"{ag}: {r.strip()}")
    if not respostas:
        return ""
    texto_base = "\n".join(respostas)
    # Se ultrapassar 500 tokens, sumariza via LLM usando ainvoke
    if contar_tokens(texto_base) > 500:
        prompt_sum = (
            "Resuma de forma direta, apenas os aprendizados essenciais do seguinte histórico entre agentes:\n"
            + texto_base
        )
        resumo = await modelo.ainvoke(prompt_sum)
        return resumo.content.strip()    # <- Corrigido aqui!
    return texto_base

# ————————————————————————
# Loop principal otimizado

async def loop_refinamento(refinador, agentes, demanda_inicial, demanda_bruta=None, modelo_sumarizador=None):
    rodada = 1
    total_prompt, total_resp = 0, 0
    respostas_acumuladas = []
    fases = [
        "problema_e_impacto",
        "fluxo_e_regras",
        "validacoes_e_dados",
        "testes_e_criterios"
    ]
    fase_agents = {
        "problema_e_impacto": ["scrum_master"],
        "fluxo_e_regras": ["qa", "ux"],
        "validacoes_e_dados": ["qa", "analista_de_dados"],
        "testes_e_criterios": ["qa"]
    }
    fase_atual = 0

    print(f"\n📌 Refinando: {demanda_inicial}\n")
    historico_refinamento = {"perguntas": [], "respostas": {}}

    while True:
        fase = fases[fase_atual]
        print(f"\n🔄 Rodada {rodada} (fase: {fase})\n")

        agentes_rel = {
            nome: agentes[nome]
            for nome in fase_agents[fase]
            if nome in agentes
        }

        try:
            perguntas = await refinador.perguntar(
                demanda_inicial,
                respostas_acumuladas,
                fase=fase,
                agentes_filtrados=agentes_rel
            )
        except Exception as e:
            print(f"Erro no refinador: {e}")
            break

        if not perguntas or all(not p.strip() for p in perguntas.values()):
            print("⚠️ Sem perguntas geradas.")
            break

        print("📈 Perguntas:")
        for ag, p in perguntas.items():
            icon = AGENTE_ICONE.get(normalizar_nome(ag), "🔹")
            print(f"{icon} {ag}: {p}")
        historico_refinamento["perguntas"].extend(perguntas.values())

        # Coleta respostas com sumarização do histórico para cada agente
        respostas_rodada = {}
        for ag, p in perguntas.items():
            ctx = await sumarizar_historico(
                respostas_acumuladas,
                modelo_sumarizador or agentes[ag],
                ag
            )
            # Corte dinâmico: só inclui contexto se não ultrapassar 1800 tokens total
            prompt = f"Demanda: {demanda_inicial}\nPergunta: {p}\nResumo histórico:\n{ctx}"
            prompt_tokens = contar_tokens(prompt)
            if prompt_tokens > 1800:
                prompt = prompt[:6000]  # força corte de texto
            r = await agentes[ag].perguntar(prompt)
            respostas_rodada[ag] = r
            historico_refinamento["respostas"].setdefault(ag, []).append(r)

        respostas_acumuladas.append(respostas_rodada)

        # PO responde dúvidas construtivas
        duvidas = extrair_duvidas(respostas_rodada)
        if duvidas:
            print("\n❓ Dúvidas Construtivas:")
            for ag, d in duvidas:
                icon = AGENTE_ICONE.get(normalizar_nome(ag), "🔸")
                print(f"{icon} {ag}: {d}")
            rd = await refinador.responder_duvidas([d for _, d in duvidas])
            print(f"\n🗈 Respostas do PO às dúvidas:\n{rd}\n")

        # Contador de tokens por rodada (perguntas e respostas)
        pt = sum(contar_tokens(p) for p in perguntas.values())
        rt = sum(contar_tokens(r) for r in respostas_rodada.values())
        total_prompt += pt
        total_resp += rt
        print(f"\n🔹 Tokens rodada: prompt={pt}, resp={rt}, acumulado prompt={total_prompt}, resp={total_resp}")

        # Avança para a próxima fase, se houver
        if fase_atual < len(fases) - 1:
            rodada += 1
            fase_atual += 1
            continue

        # Última fase: PM decide encerrar ou continuar (por saturação/redundância)
        if len(respostas_acumuladas) > 1 and respostas_redundantes(
            respostas_acumuladas[-1], respostas_acumuladas[-2]
        ):
            decisao = "saturacao"
        else:
            decisao = (await agentes["pm"].avaliar_respostas(respostas_rodada, rodada)).lower()

        print(Fore.GREEN + f"\n📋 Decisão do PM: {decisao}")

        if decisao in ["saturacao", "finalizar"]:
            # Só agora Tech Lead opina
            parecer = await agentes["tech_lead"].avaliar(demanda_inicial, respostas_acumuladas)
            print(f"\n💧 Parecer do Tech Lead:\n{parecer}\n")

            prd = await agentes["pm"].gerar_prd(demanda_inicial, respostas_acumuladas, parecer)
            tasks = await agentes["pm"].gerar_tasks(respostas_acumuladas, parecer)

            salvar_prd(prd, demanda_inicial)
            salvar_tasks(tasks, demanda_inicial)
            salvar_log_refinamento(
                demanda_original=demanda_bruta or demanda_inicial,
                demanda_funcional=demanda_inicial,
                respostas=respostas_acumuladas,
                parecer_techlead=parecer,
                decisao_pm=decisao
            )
            break
