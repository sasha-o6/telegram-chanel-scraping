create table bot_users (
  id bigserial primary key,
  telegram_user_id bigint not null unique,
  username text,
  first_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table scraper_configs (
  id bigserial primary key,
  user_id bigint not null references bot_users(id) on delete cascade,
  is_enable boolean not null default false,
  days integer not null default 2 check (days > 0),
  limit_count integer not null default 100 check (limit_count > 0),
  interval_minutes integer not null default 20 check (interval_minutes >= 20),
  channel_to_send text not null default 'me',
  channels jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  keywords2 jsonb not null default '[]'::jsonb,
  ban_words jsonb not null default '[]'::jsonb,
  last_scraped_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table telegram_secrets (
  id bigserial primary key,
  user_id bigint not null references bot_users(id) on delete cascade,
  encrypted_api_id text,
  encrypted_api_hash text,
  encrypted_string_session text,
  session_status text not null default 'missing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table auth_flows (
  id bigserial primary key,
  user_id bigint not null references bot_users(id) on delete cascade,
  chat_id bigint not null,
  current_step text not null,
  transient_metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index auth_flows_one_active_per_user
  on auth_flows(user_id)
  where completed_at is null and cancelled_at is null;

create table scrape_runs (
  id bigserial primary key,
  config_id bigint not null references scraper_configs(id) on delete cascade,
  status text not null,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table delivery_outbox (
  id bigserial primary key,
  user_id bigint not null references bot_users(id) on delete cascade,
  config_id bigint not null references scraper_configs(id) on delete cascade,
  source_id text not null,
  message_id text not null,
  post_link text not null,
  destination_chat text not null,
  formatted_message text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, config_id, source_id, message_id)
);

create table delivered_posts (
  id bigserial primary key,
  user_id bigint not null references bot_users(id) on delete cascade,
  config_id bigint not null references scraper_configs(id) on delete cascade,
  source_id text not null,
  message_id text not null,
  post_link text not null,
  delivered_at timestamptz not null default now(),
  unique(user_id, config_id, source_id, message_id)
);
