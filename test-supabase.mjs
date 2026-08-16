import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fgiusxlylytdsemhzcfc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnaXVzeGx5bHl0ZHNlbWh6Y2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODIwMjMsImV4cCI6MjA4NjU1ODAyM30.Mk5YjRowmjsS2RFpKedRffn-5bzcTBpEixr2woezS9s'
);

async function main() {
  const { data, error } = await supabase.from('empty_bottles_stock').select('*').limit(1);
  console.log('empty_bottles_stock:', error ? error.message : data);
  
  const { data: bt, error: bte } = await supabase.from('bottle_types').select('*').limit(1);
  console.log('bottle_types:', bte ? bte.message : bt);
}

main();