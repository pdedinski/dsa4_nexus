-- Codex source: WDZ summoned / invoked beings (editable via codex_entry_versions)
INSERT INTO codex_sources (id, category, file_key, array_key, label) VALUES
  ('a0000001-0000-4000-8000-000000000015'::uuid, 'bestiary', 'summoned_creatures', 'summoned_creatures', 'WdZ Summons')
ON CONFLICT (category, file_key) DO NOTHING;
