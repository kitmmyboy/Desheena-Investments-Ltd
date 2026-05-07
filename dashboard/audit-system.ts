import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://toejolbdlqtrknmujuvo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZWpvbGJkbHF0cmtubXVqdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTM3MDEsImV4cCI6MjA5MzQyOTcwMX0.4hpk6DCio9A2mXjDL9ovNemlPDk15AYRvVOJfh-6QNE'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function auditSystem() {
  console.log('=== SYSTEM AUDIT ===\n')

  // 1. Count total clients
  const { count: totalClients, error: clientsError } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
  
  if (clientsError) {
    console.error('Error counting clients:', clientsError)
    return
  }
  console.log(`1. Total clients: ${totalClients}`)

  // 2. Count active clients (is_active = true)
  const { count: activeClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  console.log(`2. Active clients (is_active=true): ${activeClients}`)

  // 3. Count inactive clients (is_active = false)
  const { count: inactiveClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false)
  console.log(`3. Inactive clients (is_active=false): ${inactiveClients}`)

  // 4. Count total contracts
  const { count: totalContracts, error: contractsError } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
  
  if (contractsError) {
    console.error('Error counting contracts:', contractsError)
    return
  }
  console.log(`4. Total contracts: ${totalContracts}`)

  // 5. Count active contracts (status = 'active' and end_date >= today or null)
  const today = new Date().toISOString().split('T')[0]
  const { data: activeContractsData } = await supabase
    .from('contracts')
    .select('client_id')
    .eq('status', 'active')
    .or(`end_date.is.null,end_date.gte.${today}`)
  
  const uniqueActiveContractClients = new Set(activeContractsData?.map(c => c.client_id) ?? []).size
  console.log(`5. Active contracts (status='active', not expired): ${activeContractsData?.length}`)
  console.log(`6. Unique clients with active contracts: ${uniqueActiveContractClients}`)

  // 7. Count clients without any contracts
  const { data: clientsWithContracts } = await supabase
    .from('contracts')
    .select('client_id')
  const clientIdsWithContracts = new Set(clientsWithContracts?.map(c => c.client_id) ?? [])
  
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name, is_active')
  
  const clientsWithoutContracts = allClients?.filter(c => !clientIdsWithContracts.has(c.id)) ?? []
  console.log(`7. Clients without any contracts: ${clientsWithoutContracts.length}`)
  if (clientsWithoutContracts.length > 0) {
    console.log('   Clients without contracts:')
    clientsWithoutContracts.slice(0, 10).forEach(c => {
      console.log(`   - ${c.name} (ID: ${c.id}, active: ${c.is_active})`)
    })
    if (clientsWithoutContracts.length > 10) {
      console.log(`   ... and ${clientsWithoutContracts.length - 10} more`)
    }
  }

  // 8. Count clients with expired contracts (end_date < today)
  const { data: expiredContracts } = await supabase
    .from('contracts')
    .select('client_id, end_date')
    .lt('end_date', today)
  
  const uniqueExpiredClients = new Set(expiredContracts?.map(c => c.client_id) ?? []).size
  console.log(`8. Expired contracts (end_date < today): ${expiredContracts?.length}`)
  console.log(`9. Unique clients with expired contracts: ${uniqueExpiredClients}`)

  // 9. Check for contracts referencing non-existent clients (orphaned contracts)
  const { data: orphanedContracts } = await supabase
    .from('contracts')
    .select('id, client_id')
  const allClientIds = new Set(allClients?.map(c => c.id) ?? [])
  const orphaned = orphanedContracts?.filter(c => !allClientIds.has(c.client_id)) ?? []
  console.log(`10. Orphaned contracts (referencing non-existent clients): ${orphaned.length}`)

  // 10. Summary
  console.log('\n=== SUMMARY ===')
  console.log(`Total clients: ${totalClients}`)
  console.log(`Clients with contracts: ${clientIdsWithContracts.size}`)
  console.log(`Clients without contracts: ${clientsWithoutContracts.length}`)
  console.log(`Clients with active contracts: ${uniqueActiveContractClients}`)
  console.log(`Clients with expired contracts: ${uniqueExpiredClients}`)
  console.log(`Orphaned contracts: ${orphaned.length}`)
}

auditSystem().catch(console.error)
