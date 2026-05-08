import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { sendData } from "./http/send.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { openapiSpec } from "./openapi.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import {
  adminFeatureFlagsRouter,
  publicFeatureFlagsRouter,
  userFeatureFlagsRouter,
} from "./modules/feature-flags/feature-flags.routes.js";
import { organizationsRouter } from "./modules/organizations/organizations.routes.js";

export function createApp() {
  const app = express();
  const logger = pino({ level: env.NODE_ENV === "test" ? "silent" : "info" });

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== "test",
    }),
  );

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: env.NODE_ENV === "test" ? 1_000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    return sendData(res, {
      status: "ok",
      service: "byepo-feature-flags-api",
      time: new Date().toISOString(),
    });
  });

  app.get("/openapi.json", (_req, res) => res.json(openapiSpec));
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
      customSiteTitle: "Byepo Feature Flags API",
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use("/v1/auth", authRouter);
  app.use("/v1/super-admin", organizationsRouter);
  app.use("/v1/admin", adminFeatureFlagsRouter);
  app.use("/v1/user", userFeatureFlagsRouter);
  app.use("/v1/public", publicFeatureFlagsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
