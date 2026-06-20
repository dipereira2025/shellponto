# Shell Café Ponto V3 HTML

Essa versão é mais fácil de subir no GitHub e Vercel porque não usa Next.js.

## Arquivos

- `index.html` = sistema
- `app.js` = lógica do sistema
- `config.js` = configuração opcional do Supabase e localização da loja
- `supabase.sql` = banco de dados
- `README.md` = instruções

## Como subir no GitHub

1. Extraia o ZIP.
2. No GitHub, abra seu repositório.
3. Clique em `Add file`.
4. Clique em `Upload files`.
5. Arraste estes arquivos:

```text
index.html
app.js
config.js
supabase.sql
README.md
```

6. Clique em `Commit changes`.

## Como publicar na Vercel

A Vercel vai publicar como site estático.

Se já estiver conectada ao GitHub, basta fazer o commit.

## Como configurar o Supabase

1. Abra seu projeto Supabase.
2. Vá em SQL Editor.
3. Abra o arquivo `supabase.sql`.
4. Copie tudo.
5. Cole no SQL Editor.
6. Clique em Run.

Depois crie o bucket:

```text
Storage > New bucket
Nome: ponto-selfies
Tipo: private
```

## Criar usuários

No Supabase:

```text
Authentication > Users > Add user
```

Crie o usuário com e-mail e senha.

Depois copie o UID do usuário.

## Criar primeiro administrador

Depois de criar seu usuário no Auth, rode no SQL Editor:

```sql
insert into profiles (id, email, name, role, shift, position, active)
values (
  'COLE_AQUI_O_UID_DO_AUTH',
  'seuemail@email.com',
  'Diego',
  'admin',
  'Administração',
  'Administrador',
  true
);
```

## Configurar o sistema

Você tem duas opções.

### Opção 1: Pela tela do sistema

Abra o site e preencha:

- Supabase URL
- Supabase anon key
- Latitude da loja
- Longitude da loja
- Raio permitido

### Opção 2: Pelo arquivo config.js

Abra `config.js` e preencha:

```js
window.SHELL_PONTO_CONFIG = {
  SUPABASE_URL: "https://seuprojeto.supabase.co",
  SUPABASE_ANON_KEY: "sua-anon-key",
  STORE_LATITUDE: "-15.000000",
  STORE_LONGITUDE: "-47.000000",
  ALLOWED_RADIUS_METERS: "120",
  STORE_NAME: "Shell Café"
};
```

## Importante

Essa versão é bem mais simples de publicar, mas ainda usa segurança no Supabase com RLS.

O funcionário:
- Só vê o próprio ponto
- Só registra ponto para ele mesmo

O administrador:
- Vê todos os funcionários
- Vê relatórios
- Exporta CSV
