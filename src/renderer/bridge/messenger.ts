// ─── Messenger Bridge ─────────────────────────────────────────────────────

function getAynite() {
  return (window as any).aynite
}

export const messenger = {
  test: (provider: string, apiKey: string) =>
    getAynite().testMessenger(provider, apiKey),
}

export const messengerMutations = {
  test: (provider: string, apiKey: string) =>
    getAynite().testMessenger(provider, apiKey),
}
