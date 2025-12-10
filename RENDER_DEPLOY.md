# 🚀 Deploy AutoGen no Render

## ⚠️ Requisitos para AutoGen Funcionar no Render

### 1. Dependências Python

O Render precisa instalar as dependências Python. Adicione ao `package.json`:

```json
{
  "scripts": {
    "postinstall": "pip3 install -r requirements.txt || true"
  }
}
```

### 2. Variáveis de Ambiente no Render

Configure estas variáveis no **Render Dashboard** → **Environment**:

#### Obrigatórias:
```bash
# Mistral API (OBRIGATÓRIO para produção)
MISTRAL_API_KEY=your_mistral_api_key_from_console_mistral_ai

# Python Path
PYTHON_PATH=/opt/render/project/src/.venv/bin/python3

# AutoGen Config
AUTOGEN_MAX_ROUNDS=5
AUTOGEN_TIMEOUT=300
```

#### Opcionais:
```bash
# Modelo Mistral (padrão: mistral-large-latest)
MISTRAL_MODEL=mistral-large-latest
MISTRAL_BASE_URL=https://api.mistral.ai/v1
```

### 3. Build Command no Render

```bash
npm install && pip3 install --user -r requirements.txt && npm run build
```

### 4. Start Command no Render

```bash
npm run start
```

---

## 📋 Checklist de Deploy

### Antes do Deploy:

- [ ] ✅ Arquivo `requirements.txt` existe na raiz do projeto
- [ ] ✅ Contém: `pyautogen`, `python-dotenv`, `js-yaml`, `mistralai`
- [ ] ✅ API Key do Mistral obtida em https://console.mistral.ai/
- [ ] ✅ Scripts `postinstall` adicionado ao `package.json`

### No Render Dashboard:

- [ ] ✅ `MISTRAL_API_KEY` configurada
- [ ] ✅ `PYTHON_PATH` configurada
- [ ] ✅ Build command atualizado
- [ ] ✅ Start command atualizado

### Após Deploy:

- [ ] ✅ Verificar logs: `pip3 install` executou com sucesso
- [ ] ✅ Testar endpoint de debate AutoGen
- [ ] ✅ Verificar disponibilidade: `GET /api/autogen/status`

---

## 🔍 Verificação de Funcionamento

### 1. Verificar Instalação Python

No Render Shell:
```bash
python3 --version
pip3 list | grep autogen
```

### 2. Testar AutoGen via API

```bash
curl -X POST https://seu-app.onrender.com/api/autogen/debate \
  -H "Content-Type: application/json" \
  -d '{
    "problem": "Teste de funcionamento",
    "maxRounds": 2
  }'
```

### 3. Verificar Logs

Procure por:
```
✅ AutoGen disponível
✅ Mistral API configurada
```

---

## 🐛 Troubleshooting no Render

### Erro: "Python not found"

**Solução:**
```bash
# Adicionar ao Build Command:
which python3 && python3 --version
```

### Erro: "pyautogen not installed"

**Solução:**
```bash
# Build Command deve incluir:
pip3 install --user -r requirements.txt
```

### Erro: "Mistral API key invalid"

**Solução:**
1. Verificar se `MISTRAL_API_KEY` está configurada no Render
2. Gerar nova key em https://console.mistral.ai/
3. Redeploy após atualizar

### Erro: "Module 'autogen' not found"

**Solução:**
```bash
# Adicionar ao package.json:
"postinstall": "pip3 install --user pyautogen python-dotenv js-yaml mistralai"
```

---

## 📦 Arquivos Necessários

### `requirements.txt` (raiz do projeto)
```txt
pyautogen>=0.2.0
python-dotenv>=1.0.0
js-yaml>=4.1.0
mistralai>=0.1.0
```

### `package.json` (adicionar script)
```json
{
  "scripts": {
    "postinstall": "pip3 install --user -r requirements.txt || true",
    "build": "tsc && cd client && npm run build",
    "start": "node dist/index.js"
  }
}
```

---

## 🔐 Segurança

### Nunca commitar:
- ❌ `.env` com API keys
- ❌ `.env.autogen` com credenciais

### Sempre usar:
- ✅ Variáveis de ambiente do Render
- ✅ `.env.example` para documentação
- ✅ `.gitignore` para arquivos sensíveis

---

## 🎯 Configuração Recomendada para Produção

### Render Environment Variables:
```bash
# API Mistral
MISTRAL_API_KEY=sk-...
MISTRAL_MODEL=mistral-large-latest

# Python
PYTHON_PATH=/opt/render/project/src/.venv/bin/python3

# AutoGen
AUTOGEN_MAX_ROUNDS=5
AUTOGEN_TIMEOUT=300

# Database (já existente)
DATABASE_URL=postgresql://...
```

### Build Command:
```bash
npm install && pip3 install --user -r requirements.txt && npm run build
```

### Start Command:
```bash
npm run start
```

---

## ✅ Validação Final

Execute estes comandos após deploy:

```bash
# 1. Verificar Python
curl https://seu-app.onrender.com/api/health

# 2. Verificar AutoGen
curl https://seu-app.onrender.com/api/autogen/status

# 3. Testar Debate
curl -X POST https://seu-app.onrender.com/api/autogen/debate \
  -H "Content-Type: application/json" \
  -d '{"problem": "Teste", "maxRounds": 2}'
```

Se todos retornarem 200 OK, AutoGen está funcionando! 🎉

---

## 📞 Suporte

Se ainda não funcionar:
1. Verificar logs do Render
2. Verificar se `requirements.txt` está na raiz
3. Verificar se `MISTRAL_API_KEY` está configurada
4. Verificar se build command instalou Python packages

**Logs importantes:**
```
Installing Python dependencies...
Successfully installed pyautogen-X.X.X
AutoGen bridge initialized
```
