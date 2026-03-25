import { getSupabaseServerClient } from "./lib/supabase/server-client"
import "dotenv/config"

async function checkTours() {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from("tours")
    .select("*")
    .limit(1)
  
  if (error) {
    console.error("Error fetching tour:", error)
    return
  }
  
  if (data && data.length > 0) {
    console.log("Tour columns:", Object.keys(data[0]))
  } else {
    // If table is empty, we can try to get column info from information_schema
    const { data: colData, error: colError } = await supabase
      .rpc('get_table_columns', { table_name: 'tours' })
    
    if (colData) {
      console.log("Columns from RPC:", colData)
    } else {
      console.log("Table is empty and RPC not found. Trying another way...")
      const { data: fallback, error: fallbackError } = await supabase.from('tours').select().limit(0);
      // Even with 0 rows, some clients return the column info or we can infer it.
      // But typically, we need at least 1 row to see keys via select('*')
    }
  }
}

checkTours()
