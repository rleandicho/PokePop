import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Check what's in the DB for CBB sets
const {data: sets} = await sb
  .from('tcg_sets')
  .select('id, name, series, printed_total')
  .ilike('id', 'zh-CBB%')
  .order('id')

console.log('Sets:', JSON.stringify(sets, null, 2))

// Check cards per set
for (const set of (sets ?? [])) {
  const {count} = await sb
    .from('tcg_cards')
    .select('id', { count: 'exact', head: true })
    .eq('set_id', set.id)
  console.log(`${set.id}: ${count} cards`)
}
