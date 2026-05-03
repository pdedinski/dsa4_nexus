-- Codex source: bestiary beasts (editable via codex_entry_versions)
INSERT INTO codex_sources (id, category, file_key, array_key, label) VALUES
  ('a0000001-0000-4000-8000-000000000014'::uuid, 'bestiary', 'beasts', 'beasts', 'Creatures')
ON CONFLICT (category, file_key) DO NOTHING;
