-- FinhubKH Journal — Live progress stage for the investor-password sync popup
-- Run in Supabase SQL Editor after schema_investor_credentials.sql

alter table investor_credentials
  add column if not exists sync_stage text;
