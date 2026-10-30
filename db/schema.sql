-- Idempotent schema; apply with `npm run db:migrate`.

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Reusable project/client pairs shown as suggestions in the invoice form.
create table if not exists clients (
  id serial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id serial primary key,
  name text not null,
  client_id integer not null references clients(id) on delete cascade,
  times_used integer not null default 0,
  last_used_at timestamptz not null default now(),
  unique (name, client_id)
);

-- Invoice history. The file itself lives in Vercel Blob.
create table if not exists invoices (
  id uuid primary key,
  invoice_number text not null,
  date date not null,
  total text not null default '',
  client_name text not null default '',
  notes text not null default '',
  file_type text not null default 'pdf' check (file_type in ('pdf', 'xlsx')),
  file_name text not null,
  blob_url text not null default '',
  blob_path text not null default '',
  uploaded_at timestamptz not null default now()
);

create index if not exists invoices_date_idx on invoices (date desc);

create table if not exists invoice_items (
  id serial primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  position integer not null default 0,
  project text not null default '',
  client text not null default ''
);

create index if not exists invoice_items_invoice_idx on invoice_items (invoice_id);
create index if not exists invoice_items_client_idx on invoice_items (client);

-- Work-in-progress invoice form, one per invoice number. Removed on finalize.
create table if not exists drafts (
  invoice_number text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Payment methods shown at the bottom of the invoice: a heading plus
-- "label: value" lines. Exactly one is the default for new invoices.
create table if not exists payment_methods (
  id serial primary key,
  name text not null,
  lines jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table invoices add column if not exists payment_method text not null default '';

-- Seed the two methods used so far, only on an empty table.
insert into payment_methods (name, lines, is_default, position)
select * from (values
  ('Transferencia bancaria', '[
    {"label": "Banco", "value": "BBVA Colombia"},
    {"label": "SWIFT/BIC", "value": "GEROCOBB"},
    {"label": "Beneficiario", "value": "DARWIN ALEJANDRO ELEGIGA LOPEZ"},
    {"label": "Número de cuenta", "value": "0390009106"}
  ]'::jsonb, true, 0),
  ('Forma de pago (Western Union)', '[
    {"label": "Nombre y apellidos", "value": "Darwin Alejandro Elégiga López"},
    {"label": "Dirección", "value": "Carrera 12B 7b-17, Melgar, Tolima, Colombia"},
    {"label": "Código postal", "value": "734001"},
    {"label": "Pasaporte", "value": "L547719"},
    {"label": "Teléfono", "value": "+57 311 491 7090"}
  ]'::jsonb, false, 1)
) as seed(name, lines, is_default, position)
where not exists (select 1 from payment_methods);

-- Yearly hours sheet ("Parte de horas"), one row per month.
create table if not exists timesheet_months (
  year integer not null,
  month integer not null check (month between 1 and 12),
  clients text not null default '',
  projects text not null default '',
  hours jsonb not null default '{}'::jsonb,
  day_types jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (year, month)
);

-- Optional email delivery of an exported invoice
alter table invoices add column if not exists emailed_to text not null default '';
alter table invoices add column if not exists emailed_at timestamptz;
