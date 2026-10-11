# Publicar o Cidade Aberta de graça e sem expirar

Arquitetura (custo zero):

| Peça | Serviço | Observação |
|---|---|---|
| Frontend (React/Vite) | **Vercel** (Hobby) | arquivos estáticos + CDN |
| API (Express) | **Vercel Function** (`/api`) | mesma origem do site: sem CORS, cookie de sessão simples |
| Banco + fotos | **Neon** (Postgres, plano Free) | 512 MB; não expira. Prefira o Neon ao Supabase: o Supabase Free **pausa** projetos parados por 7 dias |
| Mapas | OpenStreetMap + Leaflet | sem chave de API |

> O plano Hobby da Vercel é para uso não comercial. Um projeto cívico sem fins lucrativos costuma se
> encaixar, mas confira os termos atuais. A API é um único arquivo (`api/index.mjs`) e roda igual em
> qualquer host Node (Render, Fly, Koyeb...) com `pnpm --filter @workspace/api-server run build && start`.

## 1. Banco (Neon)

1. Crie um projeto em neon.tech. Região: **AWS São Paulo (sa-east-1)**.
2. Copie a connection string **pooled** (host com `-pooler`), que termina em `?sslmode=require`.
3. No seu computador, crie as tabelas e os dados iniciais:

```bash
export DATABASE_URL='postgresql://...pooler...?sslmode=require'
pnpm install
pnpm --filter @workspace/db run migrate
ADMIN_EMAIL='voce@exemplo.com' ADMIN_PASSWORD='uma-senha-longa-e-unica' pnpm --filter @workspace/db run seed
```

O `seed` só preenche tabelas vazias (categorias, bairros de João Pessoa, secretarias) e cria o
administrador. Pode ser repetido sem risco. Ajuste as listas em `lib/db/scripts/seed.mjs` antes, se quiser.

## 2. Site + API (Vercel)

1. Suba o repositório no GitHub e importe-o na Vercel (raiz do repositório; o `vercel.json` já define tudo).
2. Em **Settings → Environment Variables** cadastre:
   - `DATABASE_URL` = a string pooled do Neon
   - `SESSION_SECRET` = resultado de `openssl rand -hex 32`
3. Faça o deploy. O build roda `pnpm run build:vercel` (typecheck → frontend → `api/index.mjs`).
4. Teste: `https://SEU-SITE.vercel.app/api/healthz` deve responder `{"status":"ok"}`.

Novas migrações: depois de mudar `lib/db/src/schema`, rode `generate`, commite `lib/db/drizzle` e
rode `migrate` com a `DATABASE_URL` de produção **antes** do deploy que usa a mudança.

## 3. Fotos: como funcionam e quanto cabem

- O navegador reduz cada foto (máx. 1600 px, ~300–700 KB, JPEG) antes de enviar; isso também apaga o EXIF/GPS.
- O servidor confere os bytes do arquivo (só JPEG, PNG e WebP), remove EXIF de JPEG, e grava no Postgres (tabela `attachments`).
- Limites (variáveis de ambiente no `.env.example`): 1 MB por foto, 5 fotos por demanda/obra, 30 envios por usuário por hora e teto de 350 MB de fotos no total.
- Conta: 350 MB ≈ 700 a 1500 fotos. Se o teto chegar, a API responde 507 e avisa a administração.
  Para mais espaço, o caminho é mover as imagens para um armazenamento de objetos gratuito (ex.: Cloudflare R2, 10 GB) — só `routes/attachments.ts` precisa mudar.
- Cada foto é servida com cache de 1 ano (`immutable`), então a CDN da Vercel absorve a maior parte do tráfego.

## 4. Desenvolvimento local

```bash
cp .env.example .env            # preencha DATABASE_URL e SESSION_SECRET
set -a; source .env; set +a      # carrega as variáveis nesta sessão do terminal
pnpm --filter @workspace/api-server run dev        # API na porta 8080
pnpm --filter @workspace/cidade-aberta run dev     # site na 5173, com /api encaminhado para a 8080
```

## 5. Limites do plano grátis para ter em mente

- Neon "dorme" após alguns minutos sem uso; o primeiro acesso depois disso demora ~1 s a mais.
- Vercel Hobby: corpo de requisição de até 4,5 MB (as fotos têm 1 MB, ok) e funções com tempo limite curto.
- Tiles do OpenStreetMap são para uso moderado; se o tráfego crescer, use um provedor com plano grátis (ex.: MapTiler) ou tiles próprios.
