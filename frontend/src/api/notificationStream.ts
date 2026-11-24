import { axiosInstance } from './http'

export function watchNotifications(onUpdate: () => void) {
  const controller = new AbortController()
  let retry: number | undefined
  const connect = async () => {
    try {
      const response = await axiosInstance.get<ReadableStream<Uint8Array>>(
        '/notifications/stream',
        {
          adapter: 'fetch',
          responseType: 'stream',
          timeout: 0,
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        },
      )
      const reader = response.data.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done || controller.signal.aborted) break
          pending += decoder.decode(value, { stream: true })
          const messages = pending.split(/\r?\n\r?\n/)
          pending = messages.pop() || ''
          if (messages.some((message) => /^event: (connected|notification)\r?$/m.test(message)))
            onUpdate()
        }
      } finally {
        reader.releaseLock()
      }
    } catch {
      if (!controller.signal.aborted) onUpdate()
    } finally {
      if (!controller.signal.aborted) retry = window.setTimeout(connect, 5000)
    }
  }
  void connect()
  return () => {
    window.clearTimeout(retry)
    controller.abort()
  }
}
