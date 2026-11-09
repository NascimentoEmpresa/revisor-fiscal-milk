# Revisor Fiscal — Milk Advocacia

Desenvolvido pela **Nascimento**. Revisão de PIS/COFINS a partir das exportações 037 (Entradas) e 047 (Saídas) do SistemaMA: gera o Excel no padrão do analista e o diagnóstico em Word.

- `app/` — o sistema (motor fiscal e interface, roda no navegador). `python3 app/build.py` gera `app/dist/`.
- `vercel/` — publicação com login (Node + Neon Postgres). `python3 vercel/scripts/montar_front.py` gera `vercel/public/` a partir de `app/dist/`; deploy com `npx vercel deploy --prod` dentro de `vercel/`.
- `app/test/carga/` — teste de carga com arquivos fictícios grandes (`gerar.js`, `medir.js`, `linhas.py`).

Produção: https://revisor-fiscal-milk.vercel.app · Documentação técnica completa: ver Claude Docs do projeto.

Os dados das planilhas dos clientes nunca vão ao servidor; não versionar arquivos reais de clientes neste repositório.
