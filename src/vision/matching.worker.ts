import { matchLogo } from './matching';
self.onmessage = (event: MessageEvent<Parameters<typeof matchLogo>>) => {
  try {
    self.postMessage({ result: matchLogo(...event.data) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
