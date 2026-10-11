import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";
import { getSessionSecret } from "./lib/auth";

const app: Express = express();

// Atrás do proxy da hospedagem (Vercel, Render...): enxerga HTTPS e o IP real do cliente.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Em produção o site e a API ficam na mesma origem (/api), então CORS não é necessário.
// Só habilite se o frontend estiver em outro domínio: CORS_ORIGIN="https://meusite.com,https://outro.com".
const corsOrigins = (process.env["CORS_ORIGIN"] ?? "").split(",").map((o) => o.trim()).filter(Boolean);
if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
// Segredo obrigatório: falha na inicialização se SESSION_SECRET não estiver definido.
app.use(cookieParser(getSessionSecret()));

app.use("/api", router);

// JSON malformado, corpo grande demais etc. respondem em JSON, sem expor stack trace.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status >= 500) req.log?.error(err);
  const message =
    status >= 500 ? "Internal server error" : status === 413 ? "Arquivo grande demais" : "Invalid request";
  res.status(status).json({ error: message });
});

export default app;
