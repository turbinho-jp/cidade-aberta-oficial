// Empacota a API em UM arquivo (api/index.mjs, na raiz do repositório) para rodar como
// Função da Vercel. Diferente de build.mjs (servidor tradicional), aqui não há worker do
// pino-pretty: em produção o log sai como JSON na saída padrão.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { rm } from "node:fs/promises";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.resolve(dir, "..", "..", "api", "index.mjs");

await rm(path.dirname(outfile), { recursive: true, force: true });
await build({
  entryPoints: [path.resolve(dir, "src/vercel.ts")],
  platform: "node",
  target: "node22",
  bundle: true,
  format: "esm",
  outfile,
  logLevel: "info",
  external: ["pg-native"],
  banner: {
    js: `import { createRequire as __cr } from 'node:module';
const require = __cr(import.meta.url);`,
  },
});
