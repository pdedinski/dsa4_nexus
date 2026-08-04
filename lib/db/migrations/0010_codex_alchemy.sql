-- Codex sources: alchemy recipes, failure table, and ingredient prices
INSERT INTO codex_sources (id, category, file_key, array_key, label) VALUES
  ('a0000001-0000-4000-8000-000000000016'::uuid, 'alchemy', 'recipes',           'recipes',           'Recipes'),
  ('a0000001-0000-4000-8000-000000000017'::uuid, 'alchemy', 'failure_table',     'failure_table',     'Failure Table'),
  ('a0000001-0000-4000-8000-000000000018'::uuid, 'alchemy', 'ingredient_prices', 'ingredient_prices', 'Ingredient Prices')
ON CONFLICT (category, file_key) DO NOTHING;
