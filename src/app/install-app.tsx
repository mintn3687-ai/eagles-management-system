'use client'

import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isIosSafari() {
  const userAgent = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)
  return isIos && !isOtherIosBrowser
}

export function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isIosSafariDevice, setIsIosSafariDevice] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showIosInstructions, setShowIosInstructions] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleInteraction = () => {
      setHasInteracted(true)
      window.removeEventListener('pointerdown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
    const updateInstalledState = () => {
      setIsInstalled(mediaQuery.matches || 'standalone' in navigator && navigator.standalone === true)
    }
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    setIsIosSafariDevice(isIosSafari())
    updateInstalledState()
    mediaQuery.addEventListener('change', updateInstalledState)
    window.addEventListener('pointerdown', handleInteraction)
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      mediaQuery.removeEventListener('change', updateInstalledState)
      window.removeEventListener('pointerdown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (!hasInteracted || isInstalled || (!installPrompt && !isIosSafariDevice)) return null

  const install = async () => {
    if (!installPrompt) return

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  return (
    <aside className="mx-auto max-w-3xl px-5 pt-4 sm:px-8" aria-label="Install this app">
      {installPrompt ? (
        <button type="button" className="btn-secondary" onClick={install}>Install app</button>
      ) : (
        <div className="text-sm text-slate-600">
          <button
            type="button"
            className="min-h-11 underline underline-offset-4"
            aria-expanded={showIosInstructions}
            onClick={() => setShowIosInstructions((visible) => !visible)}
          >
            Add to Home Screen
          </button>
          {showIosInstructions && (
            <p className="mt-1">In Safari, tap Share, then choose “Add to Home Screen”.</p>
          )}
        </div>
      )}
    </aside>
  )
}
