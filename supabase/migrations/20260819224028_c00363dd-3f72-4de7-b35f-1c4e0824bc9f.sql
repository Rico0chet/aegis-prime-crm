-- roles
create type public.app_role as enum ('admin', 'producer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users read own roles" on public.user_roles
for select to authenticated using (auth.uid() = user_id);

create policy "Admins read all roles" on public.user_roles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.user_roles (user_id, role)
values ('b03f9b1b-bbed-44ca-9ce1-cfe001bd1e38', 'admin')
on conflict do nothing;

-- admin override policies on existing tables
create policy "Admins manage all clients" on public.clients
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage all policies" on public.policies
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage all tasks" on public.tasks
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage all activities" on public.activities
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage all profiles" on public.profiles
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- needs analysis
create type public.question_input_type as enum ('short_text', 'long_text', 'number', 'currency', 'date', 'yes_no', 'single_select', 'multi_select');

create table public.needs_analysis_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  product_type text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.needs_analysis_templates to authenticated;
grant all on public.needs_analysis_templates to service_role;
alter table public.needs_analysis_templates enable row level security;

create policy "Authenticated read templates" on public.needs_analysis_templates
for select to authenticated using (true);

create policy "Admins manage templates" on public.needs_analysis_templates
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create table public.needs_analysis_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.needs_analysis_templates(id) on delete cascade,
  prompt text not null,
  help_text text,
  input_type public.question_input_type not null default 'short_text',
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.needs_analysis_questions to authenticated;
grant all on public.needs_analysis_questions to service_role;
alter table public.needs_analysis_questions enable row level security;

create policy "Authenticated read questions" on public.needs_analysis_questions
for select to authenticated using (true);

create policy "Admins manage questions" on public.needs_analysis_questions
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create table public.client_needs_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id uuid not null references public.needs_analysis_templates(id) on delete restrict,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.client_needs_analyses to authenticated;
grant all on public.client_needs_analyses to service_role;
alter table public.client_needs_analyses enable row level security;

create policy "Users manage own analyses" on public.client_needs_analyses
for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Admins manage all analyses" on public.client_needs_analyses
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create table public.needs_analysis_answers (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.client_needs_analyses(id) on delete cascade,
  question_id uuid not null references public.needs_analysis_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (analysis_id, question_id)
);

grant select, insert, update, delete on public.needs_analysis_answers to authenticated;
grant all on public.needs_analysis_answers to service_role;
alter table public.needs_analysis_answers enable row level security;

create policy "Users manage own answers" on public.needs_analysis_answers
for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Admins manage all answers" on public.needs_analysis_answers
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create trigger update_needs_analysis_templates_updated_at before update on public.needs_analysis_templates
for each row execute function public.update_updated_at_column();
create trigger update_needs_analysis_questions_updated_at before update on public.needs_analysis_questions
for each row execute function public.update_updated_at_column();
create trigger update_client_needs_analyses_updated_at before update on public.client_needs_analyses
for each row execute function public.update_updated_at_column();
create trigger update_needs_analysis_answers_updated_at before update on public.needs_analysis_answers
for each row execute function public.update_updated_at_column();

-- starter templates
insert into public.needs_analysis_templates (id, name, description, product_type, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'Term Life Needs Analysis', 'Baseline income replacement and debt coverage review.', 'Term Life', 1),
  ('22222222-2222-4222-8222-222222222222', 'Final Expense Review', 'Short-form intake for final expense prospects.', 'Final Expense', 2);

insert into public.needs_analysis_questions (template_id, prompt, help_text, input_type, options, is_required, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'Annual household income', 'Gross pre-tax income for the household.', 'currency', '[]'::jsonb, true, 1),
  ('11111111-1111-4111-8111-111111111111', 'Total outstanding debt', 'Mortgage, auto, student loans, credit cards.', 'currency', '[]'::jsonb, true, 2),
  ('11111111-1111-4111-8111-111111111111', 'Number of dependents', null, 'number', '[]'::jsonb, false, 3),
  ('11111111-1111-4111-8111-111111111111', 'Does the client use tobacco?', null, 'yes_no', '[]'::jsonb, true, 4),
  ('11111111-1111-4111-8111-111111111111', 'Primary coverage goal', null, 'single_select', '["Income replacement","Mortgage protection","Education funding","Estate planning"]'::jsonb, false, 5),
  ('22222222-2222-4222-8222-222222222222', 'Desired benefit amount', null, 'currency', '[]'::jsonb, true, 1),
  ('22222222-2222-4222-8222-222222222222', 'Existing coverage in force', null, 'currency', '[]'::jsonb, false, 2),
  ('22222222-2222-4222-8222-222222222222', 'Known health conditions', null, 'long_text', '[]'::jsonb, false, 3);