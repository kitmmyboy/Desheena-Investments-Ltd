import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface BrandingSettings {
  app_title: string
  app_favicon_url: string
}

async function fetchBranding(): Promise<BrandingSettings> {
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['app_title', 'app_favicon_url'])

  const map: Record<string, string> = {}
  ;(data ?? []).forEach((row: { key: string; value: string }) => {
    map[row.key] = row.value
  })

  return {
    app_title: map['app_title'] || 'Desheena Admin',
    app_favicon_url: map['app_favicon_url'] || '',
  }
}

/**
 * Applies app_title and app_favicon_url from system_settings to the document.
 * Call once near the root of the authenticated app.
 */
export function useAppBranding() {
  const { data } = useQuery<BrandingSettings>({
    queryKey: ['app_branding'],
    queryFn: fetchBranding,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  useEffect(() => {
    if (!data) return

    // Update document title
    document.title = data.app_title

    // Update favicon
    if (data.app_favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = data.app_favicon_url
    }
  }, [data])
}
