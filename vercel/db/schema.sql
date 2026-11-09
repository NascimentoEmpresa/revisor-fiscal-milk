-- Revisor Fiscal: contas de acesso. Os dados das planilhas NÃO vão para o banco (são processados só no navegador).
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  papel         TEXT NOT NULL DEFAULT 'analista' CHECK (papel IN ('admin', 'analista')),
  senha_hash    TEXT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  trocar_senha  BOOLEAN NOT NULL DEFAULT TRUE,
  sessao_versao INTEGER NOT NULL DEFAULT 1,
  cargo TEXT, oab TEXT, telefone TEXT, escritorio TEXT, cidade TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_login  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS tentativas_login (
  id     SERIAL PRIMARY KEY,
  email  TEXT NOT NULL,
  ip     TEXT NOT NULL,
  ok     BOOLEAN NOT NULL,
  em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tentativas_email_em ON tentativas_login (email, em);
CREATE INDEX IF NOT EXISTS tentativas_ip_em ON tentativas_login (ip, em);
CREATE TABLE IF NOT EXISTS auditoria (
  id       SERIAL PRIMARY KEY,
  usuario  INTEGER,
  acao     TEXT NOT NULL,
  detalhe  TEXT,
  ip       TEXT,
  em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
