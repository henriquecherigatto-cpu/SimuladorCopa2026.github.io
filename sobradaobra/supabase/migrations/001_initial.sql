-- ============================================================
-- SobraDaObra — Schema inicial do banco de dados (Supabase/PostgreSQL)
-- Execute este SQL no painel do Supabase: SQL Editor → New query
-- ============================================================

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfis de usuário (extende auth.users do Supabase)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  foto_url text,
  cidade text,
  estado text,
  telefone text,
  bio text,
  avaliacao_media decimal(3,2) default 0,
  total_avaliacoes integer default 0,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now()
);

-- Categorias de material
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  slug text not null unique,
  icone text not null,
  cor text
);

-- Anúncios
create table public.listings (
  id uuid default uuid_generate_v4() primary key,
  vendedor_id uuid references public.profiles on delete cascade not null,
  titulo text not null,
  descricao text,
  categoria_id uuid references public.categories,
  quantidade decimal(10,2),
  unidade text,
  estado_material text check (estado_material in ('novo', 'sobra_nova', 'usado', 'com_defeito')) default 'sobra_nova',
  preco decimal(10,2),
  tipo_negociacao text check (tipo_negociacao in ('fixo', 'negociavel', 'troca', 'doacao')) default 'negociavel',
  cep text,
  cidade text,
  bairro text,
  estado_uf text,
  latitude decimal(10,8),
  longitude decimal(11,8),
  ativo boolean default true,
  vendido boolean default false,
  destaque boolean default false,
  visualizacoes integer default 0,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now()
);

-- Fotos dos anúncios
create table public.listing_images (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references public.listings on delete cascade not null,
  url text not null,
  ordem integer default 0
);

-- Mensagens (chat interno)
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references public.listings on delete cascade,
  remetente_id uuid references public.profiles on delete cascade not null,
  destinatario_id uuid references public.profiles on delete cascade not null,
  conteudo text not null,
  lido boolean default false,
  criado_em timestamp with time zone default now()
);

-- Avaliações
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  avaliador_id uuid references public.profiles on delete cascade not null,
  avaliado_id uuid references public.profiles on delete cascade not null,
  listing_id uuid references public.listings on delete set null,
  nota integer check (nota between 1 and 5) not null,
  comentario text,
  criado_em timestamp with time zone default now(),
  unique(avaliador_id, listing_id)
);

-- Denúncias
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references public.profiles on delete cascade not null,
  listing_id uuid references public.listings on delete cascade not null,
  motivo text not null,
  criado_em timestamp with time zone default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (segurança por linha)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

-- Perfis: qualquer um pode ler, só o dono edita
create policy "Perfis visíveis a todos" on public.profiles
  for select using (true);
create policy "Usuário cria próprio perfil" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Usuário atualiza próprio perfil" on public.profiles
  for update using (auth.uid() = id);

-- Anúncios: anúncios ativos são públicos; só o vendedor edita/deleta
create policy "Anúncios ativos visíveis a todos" on public.listings
  for select using (ativo = true or vendedor_id = auth.uid());
create policy "Usuário autenticado cria anúncio" on public.listings
  for insert with check (auth.uid() = vendedor_id);
create policy "Vendedor edita próprio anúncio" on public.listings
  for update using (auth.uid() = vendedor_id);
create policy "Vendedor deleta próprio anúncio" on public.listings
  for delete using (auth.uid() = vendedor_id);

-- Fotos: leitura pública; vendedor gerencia
create policy "Fotos visíveis a todos" on public.listing_images
  for select using (true);
create policy "Vendedor gerencia fotos" on public.listing_images
  for all using (
    exists (select 1 from public.listings where id = listing_id and vendedor_id = auth.uid())
  );

-- Mensagens: só os participantes da conversa veem
create policy "Participantes veem mensagens" on public.messages
  for select using (auth.uid() = remetente_id or auth.uid() = destinatario_id);
create policy "Autenticado envia mensagem" on public.messages
  for insert with check (auth.uid() = remetente_id);
create policy "Destinatário marca como lido" on public.messages
  for update using (auth.uid() = destinatario_id);

-- Avaliações: leitura pública, avaliador cria
create policy "Avaliações visíveis a todos" on public.reviews
  for select using (true);
create policy "Autenticado cria avaliação" on public.reviews
  for insert with check (auth.uid() = avaliador_id);

-- Denúncias: só o denunciante cria e vê a própria
create policy "Usuário cria denúncia" on public.reports
  for insert with check (auth.uid() = reporter_id);

-- ============================================================
-- FUNÇÕES E TRIGGERS
-- ============================================================

-- Cria perfil automaticamente quando usuário se cadastra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atualiza média de avaliações após nova review
create or replace function public.update_user_rating()
returns trigger as $$
begin
  update public.profiles
  set
    avaliacao_media = (select avg(nota) from public.reviews where avaliado_id = new.avaliado_id),
    total_avaliacoes = (select count(*) from public.reviews where avaliado_id = new.avaliado_id)
  where id = new.avaliado_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_created
  after insert on public.reviews
  for each row execute procedure public.update_user_rating();

-- ============================================================
-- STORAGE (execute no Supabase Dashboard > Storage)
-- ============================================================
-- Crie um bucket chamado "listing-images" com acesso público:
-- Storage > New bucket > Name: listing-images > Public: ON

-- ============================================================
-- CATEGORIAS INICIAIS
-- ============================================================

insert into public.categories (nome, slug, icone, cor) values
  ('Alvenaria', 'alvenaria', '🧱', '#c0392b'),
  ('Madeira e Marcenaria', 'madeira-marcenaria', '🪵', '#8B4513'),
  ('Pisos e Revestimentos', 'pisos-revestimentos', '⬜', '#7f8c8d'),
  ('Telhas e Coberturas', 'telhas-coberturas', '🏠', '#e67e22'),
  ('Tintas e Acabamentos', 'tintas-acabamentos', '🎨', '#9b59b6'),
  ('Elétrica e Fiação', 'eletrica-fiacao', '⚡', '#f39c12'),
  ('Hidráulica e Encanamento', 'hidraulica-encanamento', '🚿', '#3498db'),
  ('Ferragens e Fixadores', 'ferragens-fixadores', '🔩', '#95a5a6'),
  ('Portas e Janelas', 'portas-janelas', '🚪', '#1abc9c'),
  ('Louças e Metais', 'loucas-metais', '🚽', '#2ecc71'),
  ('Ferramentas', 'ferramentas', '🔧', '#e74c3c'),
  ('Outros', 'outros', '📦', '#bdc3c7');
