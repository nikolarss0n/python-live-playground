import { reviewDesignPatterns } from './designPatterns'

self.onmessage = (event: MessageEvent<Record<string, string>>) => {
  self.postMessage(reviewDesignPatterns(event.data))
}
