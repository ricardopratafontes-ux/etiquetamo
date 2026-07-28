// Schema do Postgres onde vivem as tabelas do EtiquetaMO.
//
// Historicamente era `public`, no projeto Supabase proprio do etiquetamo.
// Na consolidacao de 07/2026 o app passou a viver no schema `etiqueta` do
// projeto principal — mas o schema continua AUTOCONTIDO, porque o EtiquetaMO
// e candidato a virar produto vendido e precisa sair inteiro num
// `pg_dump -n etiqueta`.
//
// Fica em env de proposito: a virada de um banco para o outro e uma troca de
// configuracao, nao um deploy de codigo. Rollback = voltar a variavel.
export const SUPABASE_SCHEMA =
  process.env.NEXT_PUBLIC_SUPABASE_SCHEMA?.trim() || "public";
