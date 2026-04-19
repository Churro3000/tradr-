import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useLogo(type) {
  const [logoUrl, setLogoUrl] = useState(localStorage.getItem(`${type}LogoUrl`) || null)
  const [logoShape, setLogoShape] = useState(localStorage.getItem(`${type}LogoShape`) || 'square')

  useEffect(() => {
    // Load from Supabase on mount
    async function load() {
      try {
        const { data } = await supabase.storage.from('logos').list('')
        if (!data) return
        const file = data.find(f => f.name.startsWith(`${type}-logo`))
        if (file) {
          const { data: urlData } = supabase.storage.from('logos').getPublicUrl(file.name)
          setLogoUrl(urlData.publicUrl)
          localStorage.setItem(`${type}LogoUrl`, urlData.publicUrl)
        }
      } catch (e) {}
    }
    load()

    function onLogoUpdate(e) {
      if (e.detail.type === type) setLogoUrl(e.detail.url)
    }
    function onShapeUpdate(e) {
      if (e.detail.type === type) setLogoShape(e.detail.shape)
    }

    window.addEventListener('logoUpdated', onLogoUpdate)
    window.addEventListener('logoShapeUpdated', onShapeUpdate)
    return () => {
      window.removeEventListener('logoUpdated', onLogoUpdate)
      window.removeEventListener('logoShapeUpdated', onShapeUpdate)
    }
  }, [type])

  return { logoUrl, logoShape }
}