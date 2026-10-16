// Dados iniciais para um banco NOVO (Neon, Supabase...). É idempotente: só preenche tabela vazia
// e só cria o administrador se o e-mail ainda não existir.
//
//   ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='uma-senha-longa' pnpm --filter @workspace/db run seed
//
// Sem ADMIN_EMAIL/ADMIN_PASSWORD, só categorias, bairros e secretarias são criados.
// Categorias, bairros e secretarias são pontos de partida: ajuste à realidade da prefeitura.
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não está definida.");
  process.exit(1);
}

const categories = [
  ["Buraco na via", "Construction", "#F97316", "Buracos, asfalto danificado e calçadas quebradas"],
  ["Iluminação pública", "Lightbulb", "#EAB308", "Postes apagados, lâmpadas queimadas, fiação exposta"],
  ["Limpeza urbana", "Trash2", "#22C55E", "Lixo acumulado, entulho e terrenos sujos"],
  ["Água e esgoto", "Droplets", "#3B82F6", "Vazamentos, esgoto a céu aberto, bueiros entupidos"],
  ["Árvores e áreas verdes", "TreePine", "#16A34A", "Podas, árvores caídas e praças abandonadas"],
  ["Trânsito e sinalização", "Bus", "#8B5CF6", "Semáforos, placas e faixas de pedestres"],
  ["Segurança", "ShieldAlert", "#EF4444", "Pontos de risco e falta de policiamento"],
  ["Outros", "AlertCircle", "#64748B", "Demais problemas urbanos"],
];

const neighborhoods = [
  "Água Fria", "Altiplano Cabo Branco", "Bairro dos Estados", "Bairro dos Ipês", "Bancários", "Bessa",
  "Cabo Branco", "Castelo Branco", "Centro", "Cidade dos Colibris", "Cruz das Armas", "Cristo Redentor",
  "Expedicionários", "Funcionários", "Geisel", "Gramame", "Jaguaribe", "Jardim Cidade Universitária",
  "Jardim Oceania", "Jardim São Paulo", "Mandacaru", "Mangabeira", "Manaíra", "Miramar", "Oitizeiro",
  "Padre Zé", "Paratibe", "Roger", "Tambaú", "Tambauzinho", "Torre", "Valentina", "Varadouro",
];

const departments = [
  ["Secretaria de Infraestrutura", "Obras, pavimentação e drenagem"],
  ["Secretaria de Mobilidade Urbana", "Trânsito, transporte e sinalização"],
  ["Secretaria de Meio Ambiente", "Áreas verdes, arborização e fiscalização ambiental"],
  ["Limpeza Urbana", "Coleta de lixo, varrição e capina"],
  ["Iluminação Pública", "Manutenção da rede de iluminação"],
];

const pool = new pg.Pool({ connectionString: url, max: 1 });

async function fillIfEmpty(table, insert) {
  const { rows: [r] } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
  if (r.n > 0) {
    console.log(`[seed] ${table}: já tem ${r.n} registro(s), mantido.`);
    return;
  }
  await insert();
  console.log(`[seed] ${table}: preenchida.`);
}

try {
  await fillIfEmpty("categories", async () => {
    for (const [name, icon, color, description] of categories) {
      await pool.query(`INSERT INTO categories (name, icon, color, description) VALUES ($1,$2,$3,$4)`, [name, icon, color, description]);
    }
  });
  await fillIfEmpty("neighborhoods", async () => {
    for (const name of neighborhoods) await pool.query(`INSERT INTO neighborhoods (name) VALUES ($1)`, [name]);
  });
  await fillIfEmpty("departments", async () => {
    for (const [name, description] of departments) {
      await pool.query(`INSERT INTO departments (name, description) VALUES ($1,$2)`, [name, description]);
    }
  });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("ADMIN_PASSWORD precisa ter pelo menos 10 caracteres.");
    // Mesmo formato de hashPassword() em artifacts/api-server/src/lib/auth.ts:
    // scrypt$N$r$p$<salt hex>$<hash hex>.
    const salt = randomBytes(16);
    const hash = `scrypt$16384$8$1$${salt.toString("hex")}$${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex")}`;
    const { rowCount } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Administração', $1, $2, 'admin') ON CONFLICT (email) DO NOTHING`,
      [email, hash],
    );
    console.log(rowCount ? `[seed] administrador criado: ${email}` : `[seed] ${email} já existe, mantido.`);
  } else {
    console.log("[seed] ADMIN_EMAIL/ADMIN_PASSWORD não informados: nenhum administrador criado.");
  }
} finally {
  await pool.end();
}
