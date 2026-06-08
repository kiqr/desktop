/// <reference types="vite/client" />
import type {KiqrApi} from '../../preload/index';

declare global {
  interface Window {
    kiqr: KiqrApi;
  }
}
