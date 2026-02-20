import { Plugin } from 'vite';

declare function devBanner(): Plugin;

var version = "0.1.0";

export { devBanner, version };
