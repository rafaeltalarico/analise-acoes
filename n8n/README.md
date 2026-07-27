# n8n Workflow — Radar de Ativos (Telegram Bot)

## Pré-requisitos

- n8n >= 0.214 (para `$helpers.httpRequest` no nó "Get Summary")
- Backend FastAPI rodando e acessível via URL pública ou na mesma rede do n8n
- Bot do Telegram criado via [@BotFather](https://t.me/BotFather)

## Como importar

1. Abra seu n8n
2. Vá em **Workflows > Import**
3. Selecione o arquivo `workflow_telegram_bot.json`
4. Configure as credenciais e variáveis abaixo

## O que configurar após importar

### 1. Credencial do Telegram

Em todos os nós com `REPLACE_CREDENTIAL_ID`:
- Crie uma credential do tipo **Telegram API** no n8n
- Cole o token do seu bot (gerado pelo BotFather)
- Selecione essa credential em cada nó Telegram

### 2. URL da sua API

Substitua `YOUR_API_URL` pela URL onde o backend FastAPI está rodando.
Exemplos:
- `http://localhost:8000` (local)
- `https://seu-servidor.com` (producão)

Nós que precisam de ajuste:
- **Get Movers** — URL do endpoint movers
- **Get Sector Stocks** — URL do endpoint sector
- **Get Summary** — constante `API` no código JavaScript
- **Analyze Ticker** — URL do endpoint telegram/analyze

### 3. Ativar o workflow

Após configurar, clique em **Activate** no canto superior direito.

## Fluxo de conversão

```
Usuário envia /start ou menu
  → Menu principal (botões inline)
      ├─ Analisar Ativo (Ticker)
      │    → Bot pede o ticker
      │    → Usuário digita ex: AAPL
      │    → Bot envia: preço + Snowflake + Price Target
      ├─ Buscar Ativos
      │    ├─ Principais Ganhos → lista com botões → análise
      │    ├─ Principais Perdas → lista com botões → análise
      │    └─ Por Setor → menu de setores → lista → análise
      └─ Resumo do Dia
           → Top 5 altas + top 5 baixas do dia
```

## Ticker detection (mensagens de texto)

Qualquer mensagem de texto que parecer um ticker americano válido
(letras maiúsculas, 1-5 caracteres, ex: `AAPL`, `BRK-B`)
é automaticamente tratada como pedido de análise.
