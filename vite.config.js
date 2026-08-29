import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    server: {
        port: 5174
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                combustivel: resolve(__dirname, 'combustivel.html'),
                manutencao: resolve(__dirname, 'manutencao.html')
            }
        }
    }
})
