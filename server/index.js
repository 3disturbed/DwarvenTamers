import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(ROOT, { extensions: ['html'] }));
app.get('*', (_req, res) => res.sendFile(join(ROOT, 'index.html')));

app.listen(PORT, () => {
  console.log(`[SoloHiem] Static game available at http://localhost:${PORT}`);
});
