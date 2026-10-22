import { defineConfig } from 'vite';
export default defineConfig({base:'/NOVEX/',publicDir:'public',server:{host:'0.0.0.0'},build:{target:'es2022',assetsInlineLimit:4096}});