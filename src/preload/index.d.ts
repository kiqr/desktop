import type {KiqrApi} from './index';

declare global {
  interface Window {
    kiqr: KiqrApi;
  }
}
