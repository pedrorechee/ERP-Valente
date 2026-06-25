// Login "convidado" (entrar sem autenticação) — concede acesso TOTAL como dono
// via service client (bypassa RLS). Sempre disponível em desenvolvimento.
//
// ⚠️ Em PRODUÇÃO só é habilitado quando NEXT_PUBLIC_ALLOW_GUEST="1".
// Ligar essa flag torna o sistema acessível SEM SENHA para qualquer pessoa
// que abrir o link — use apenas para demonstração e desligue depois.
//
// Como a variável é NEXT_PUBLIC_*, é embutida no build: ao ligar/desligar na
// Vercel é necessário um novo deploy para ter efeito.
export const GUEST_LOGIN_ENABLED =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_ALLOW_GUEST === '1'
