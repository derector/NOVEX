import { defineConfig } from 'vite';
export default defineConfig({base:process.env.VITE_BASE_PATH||'/',publicDir:'public',server:{host:'0.0.0.0'},build:{target:'es2022',assetsInlineLimit:4096}});