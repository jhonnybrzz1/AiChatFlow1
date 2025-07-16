import os
import asyncio
import importlib.util
from dotenv import load_dotenv
from colorama import init

from langchain_openai import ChatOpenAI

from prompts.refinador import Refinador
from utils.loop_refinamento import loop_refinamento, carregar_vectores

init(autoreset=True)
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("Defina OPENAI_API_KEY no arquivo .env")

# Instâncias de modelo específicas por tipo de uso
def criar_modelo_4o():
    return ChatOpenAI(
        temperature=0.2,
        model="gpt-4o-2024-08-06",
        openai_api_key=api_key,
        max_tokens=2048
    )

def criar_modelo_35():
    return ChatOpenAI(
        temperature=0.2,
        model="gpt-3.5-turbo-0125",
        openai_api_key=api_key,
        max_tokens=1024
    )

def criar_modelo_sum():
    return ChatOpenAI(
        temperature=0.0,
        model="gpt-3.5-turbo-0125",
        openai_api_key=api_key,
        max_tokens=512
    )

def to_camel_case(snake_str):
    components = snake_str.split('_')
    return ''.join(x.title() for x in components)

def carregar_outros_agentes(pasta="prompts", modelos=None):
    prompts = {}
    if not os.path.exists(pasta):
        raise FileNotFoundError(
            f"A pasta '{pasta}' não existe. Crie-a com os arquivos dos agentes, exceto refinador.py."
        )
    for nome_arquivo in os.listdir(pasta):
        if nome_arquivo in ["refinador.py", "consultor_prd.py"]:
            continue
        caminho = os.path.join(pasta, nome_arquivo)
        if os.path.isfile(caminho) and nome_arquivo.endswith(".py"):
            agente_nome = os.path.splitext(nome_arquivo)[0]
            try:
                spec = importlib.util.spec_from_file_location(agente_nome, caminho)
                modulo = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(modulo)
                if agente_nome == "analista_de_dados":
                    class_name = "Dados"
                elif agente_nome == "ux":
                    class_name = "Ux"
                else:
                    class_name = to_camel_case(agente_nome)
                agente_class = getattr(modulo, class_name, None)
                if not agente_class:
                    print(f"Aviso: O arquivo '{nome_arquivo}' não contém a classe '{class_name}'.")
                    continue
                # Aqui escolhemos o modelo para cada agente
                if modelos and agente_nome in modelos:
                    modelo = modelos[agente_nome]
                else:
                    modelo = criar_modelo_35()
                agente_instance = agente_class(modelo)
                prompts[agente_nome] = (agente_instance, None)
            except Exception as e:
                print(f"Erro ao abrir o arquivo '{nome_arquivo}': {e}")
                continue
    if not prompts:
        raise ValueError("Nenhum arquivo com instruções válidas foi encontrado na pasta 'prompts' (exceto refinador e consultor_prd).")
    return prompts

class Agente:
    def __init__(self, nome, prompt, modelo, instancia=None):
        self.nome = nome
        self.prompt = prompt
        self.modelo = modelo
        self.historico = []
        self.instancia = instancia

    async def perguntar(self, pergunta):
        try:
            if self.instancia and hasattr(self.instancia, "perguntar"):
                resposta = await self.instancia.perguntar(pergunta)
                if not resposta:
                    resposta = "Nenhuma resposta recebida."
                self.historico.append((pergunta, resposta))
                return resposta
            from langchain_core.messages import SystemMessage, HumanMessage
            mensagens = [
                SystemMessage(content=self.prompt or ""),
                HumanMessage(content=pergunta)
            ]
            resposta = await self.modelo.agenerate([mensagens])
            texto = resposta.generations[0][0].text.strip()
            if not texto:
                texto = "Nenhuma resposta recebida."
            self.historico.append((pergunta, texto))
            return texto
        except Exception as e:
            return f"Erro ao perguntar para {self.nome}: {e}"

class TechLead:
    def __init__(self, modelo, modelo_sumarizador=None):
        self.nome = "tech_lead"
        self.prompt = (
            "Você é Tech Lead. Forneça parecer técnico com: viabilidade, riscos técnicos, "
            "sugestão de arquitetura, tecnologias recomendadas e considerações de segurança/escalabilidade."
        )
        self.modelo = modelo
        self.modelo_sumarizador = modelo_sumarizador
        self.historico = []

    async def perguntar(self, pergunta):
        from langchain_core.messages import SystemMessage, HumanMessage
        mensagens = [
            SystemMessage(content=self.prompt.strip()),
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
        if self.modelo_sumarizador:
            prompt_sum = (
                "Resuma objetivamente os principais pontos técnicos das rodadas de refinamento abaixo:\n"
                + str(respostas)
            )
            resumo = await self.modelo_sumarizador.ainvoke(prompt_sum)
        else:
            resumo = str(respostas)
        prompt = f"""
Você é Tech Lead. Analise a demanda abaixo:

>> {demanda}

Com base no resumo técnico das rodadas de refinamento a seguir, forneça seu parecer técnico final:

{resumo}
"""
        return await self.perguntar(prompt)

def obter_demanda():
    print("\n📌 Como você quer fornecer a demanda?")
    print("1 - Digitar agora na tela")
    print("2 - Usar o conteúdo de um arquivo .txt")
    escolha = input("Escolha (1 ou 2): ").strip()
    if escolha == "1":
        print("\n✍️ Digite a demanda abaixo (pressione Enter para finalizar):")
        return input(">> ").strip()
    elif escolha == "2":
        caminho = input("🗂️ Caminho do arquivo .txt (ou deixe vazio para usar 'entrada.txt'): ").strip()
        if not caminho:
            caminho = "entrada.txt"
        if os.path.exists(caminho):
            with open(caminho, "r", encoding="utf-8") as arquivo:
                demanda = arquivo.read().strip()
                print(f"\n📄 Demanda carregada do arquivo '{caminho}':\n{demanda}")
                return demanda
        else:
            print("❌ Arquivo não encontrado. Abortando.")
            exit()
    else:
        print("❌ Opção inválida. Tente novamente.\n")
        return obter_demanda()

async def main():
    # Modelos distintos
    modelo_4o = criar_modelo_4o()
    modelo_35 = criar_modelo_35()
    modelo_sum = criar_modelo_sum()

    vectorstore_rfm, vectorstore_completo = carregar_vectores()

    # Defina aqui qual modelo cada agente usará:
    modelos_por_agente = {
        "qa": modelo_4o,               # QA → GPT-4o (para qualidade máxima)
        "pm": modelo_4o,               # PM → GPT-4o (documentos, decisão de loop)
        "scrum_master": modelo_35,     # Scrum Master → GPT-3.5 (orientação de processo)
        "ux": modelo_35,               # UX → GPT-3.5 (sugestões de tela, geralmente barato)
        "analista_de_dados": modelo_35 # Analista de Dados → GPT-3.5 (só usa GPT-4o se necessário)
    }

    # Carrega os agentes dinâmicos com modelo definido para cada um
    outros = carregar_outros_agentes("prompts", modelos=modelos_por_agente)
    outros_instancias = {nome: instancia for nome, (instancia, _) in outros.items()}

    # Instancia o refinador sempre com GPT-4o (sugestão)
    refinador_instancia = Refinador(
        modelo_4o,
        outros_instancias,
        vectorstore_rfm=vectorstore_rfm,
        vectorstore_completo=vectorstore_completo
    )
    prompt_refinador = refinador_instancia.get_prompt()

    # Junta todos os agentes
    agentes = {
        "refinador": Agente("refinador", prompt_refinador, modelo_4o, refinador_instancia),
        "tech_lead": TechLead(modelo_4o, modelo_sum)  # TechLead usa 4o + sumarizador 3.5
    }
    for nome, (instancia, prompt) in outros.items():
        agentes[nome] = Agente(nome, prompt, modelos_por_agente.get(nome, modelo_35), instancia)

    demanda_bruta = obter_demanda()
    if not demanda_bruta:
        raise ValueError("Você precisa descrever um projeto para continuar.")

    # Reformulação pelo PM (validação funcional)
    pm = agentes.get("pm")
    if not pm or not hasattr(pm.instancia, "validar_e_reformular_demanda"):
        raise ValueError("Agente PM com função de validação não encontrado ou incompleto.")

    demanda_funcional = await pm.instancia.validar_e_reformular_demanda(demanda_bruta)

    # Loop principal de refinamento já otimizado
    await loop_refinamento(
        refinador_instancia,
        {nome: agente.instancia for nome, agente in agentes.items()},
        demanda_funcional,
        demanda_bruta,
        modelo_sumarizador=modelo_sum
    )

if __name__ == "__main__":
    asyncio.run(main())
