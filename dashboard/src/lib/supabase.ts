import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://toejolbdlqtrknmujuvo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZWpvbGJkbHF0cmtubXVqdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTM3MDEsImV4cCI6MjA5MzQyOTcwMX0.4hpk6DCio9A2mXjDL9ovNemlPDk15AYRvVOJfh-6QNE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
