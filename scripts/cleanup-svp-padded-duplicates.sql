-- Cleanup for accidental padded Scarlet & Violet Promo duplicate IDs.
--
-- Context:
--   Existing PokemonTCG API rows use IDs like svp-1, svp-27, svp-99.
--   An earlier PkmnCards import pass created duplicates like svp-001, svp-027,
--   svp-099. This deletes only padded rows that have a canonical unpadded row.
--
-- Run in Supabase SQL Editor.

delete from public.tcg_cards padded
where padded.set_id = 'svp'
  and padded.id ~ '^svp-0+[0-9]+$'
  and exists (
    select 1
    from public.tcg_cards canonical
    where canonical.id = 'svp-' || regexp_replace(padded.number, '^0+', '')
      and canonical.set_id = 'svp'
  );

select
  s.id,
  s.name,
  s.total,
  count(c.id) as actual_card_count
from public.tcg_sets s
left join public.tcg_cards c on c.set_id = s.id
where s.id = 'svp'
group by s.id, s.name, s.total;
