# Shell Café Gestão V4

Versão definitiva focada em controle de ponto e operação 24h.

## Inclui

- Multi-lojas
- Ponto com localização para auditoria
- Selfie opcional
- Dashboard operacional
- Funcionários trabalhando agora
- Registros fora da área esperada
- Cadastro de usuários pela área admin
- Perfis:
  - Super Admin
  - Gerente da loja
  - Funcionário
- Livro de ocorrências
- Checklist operacional
- Relatórios por loja, funcionário e período
- Exportação CSV
- PWA para instalar no celular

## Arquivos principais

- `index.html`
- `app.js`
- `config.js`
- `supabase.sql`
- `api/admin-users.js`
- `package.json`
- `manifest.json`

## 1. Supabase

No Supabase, vá em:

SQL Editor > New Query

Cole todo o conteúdo de `supabase.sql` e clique em Run.

Depois crie o bucket:

Storage > New bucket

Nome:

`ponto-selfies`

Tipo:

Private

## 2. Criar seu primeiro usuário admin

No Supabase:

Authentication > Users > Add user

Crie seu usuário.

Depois copie o UID do usuário.

Rode este SQL, trocando o UID e e-mail:

```sql
insert into profiles (id, email, name, role, shift, position, active)
values (
  'COLE_AQUI_O_UID_DO_AUTH',
  'dptech2025@gmail.com',
  'Diego',
  'super_admin',
  'Administração',
  'Administrador',
  true
);
```

## 3. Configurar o site

Você pode configurar pela tela inicial ou editar o arquivo `config.js`:

```js
window.SHELL_GESTAO_CONFIG = {
  SUPABASE_URL: "https://seuprojeto.supabase.co",
  SUPABASE_ANON_KEY: "sua-anon-key"
};
```

## 4. Variáveis na Vercel

Para criar usuários dentro do sistema, configure estas variáveis na Vercel:

```env
SUPABASE_URL=https://seuprojeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

A Service Role Key fica em:

Supabase > Project Settings > API

Nunca coloque a Service Role Key no GitHub ou no config.js.

## 5. Subir no GitHub

Envie todos os arquivos para um repositório novo.

Recomendo criar um repositório separado:

`shell-cafe-gestao-v4`

## 6. Publicar na Vercel

Vercel > Add New Project > Import GitHub

Depois configure as variáveis acima e faça Deploy.

## 7. Configurar lojas

A V4 já cria lojas padrão:

- Shell Café Samambaia Norte
- Shell Café Samambaia Sul
- Shell Café Riacho Fundo II
- Shell Café QS 07
- Point do Café Setor O

Depois você pode ajustar nomes, referências, latitude, longitude e raio de auditoria.

## Importante

A localização é para auditoria, não bloqueia o ponto.

Se o funcionário bater ponto longe da loja, o sistema marca:

`Fora da área`

mas ainda registra o ponto.
