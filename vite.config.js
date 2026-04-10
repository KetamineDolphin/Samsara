import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function anthropicProxy() {
  let apiKey = '';
  return {
    name: 'anthropic-proxy',
    configResolved(config) {
      apiKey = process.env.ANTHROPIC_API_KEY || '';
    },
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        try {
          let body = '';
          await new Promise((resolve, reject) => {
            req.on('data', chunk => { body += chunk; });
            req.on('end', resolve);
            req.on('error', reject);
          });
          const parsed = JSON.parse(body);
          // Strip apiKey from client payload if present
          delete parsed.apiKey;

          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(parsed),
          });

          res.statusCode = anthropicRes.status;
          res.setHeader('Content-Type', 'application/json');
          const data = await anthropicRes.text();
          res.end(data);
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Proxy error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY || '';

  return {
    plugins: [react(), anthropicProxy()],
    resolve: {
      alias: {
        react: path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
