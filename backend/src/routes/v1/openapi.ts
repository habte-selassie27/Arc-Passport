import { Router, Request, Response } from "express";
import { buildOpenApiDocument } from "../../openapi/registry.js";

const router = Router();

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArcPass API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "/v1/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        defaultModelsExpandDepth: -1,
        docExpansion: "list",
        filter: true,
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`;

router.get("/openapi.json", (_req: Request, res: Response) => {
  try {
    const doc = buildOpenApiDocument();
    res.json(doc);
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: { code: "OPENAPI_BUILD_FAILED", message: (err as Error).message },
    });
  }
});

router.get("/docs", (_req: Request, res: Response) => {
  res.type("html").send(SWAGGER_HTML);
});

export default router;
