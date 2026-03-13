import { Router } from "express";
import { upload } from "../lib/upload";
import { requireAppAuth, requireTenantActive } from "../middleware/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive);

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }

  const url = `/uploads/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename, size: req.file.size });
});

// Error handler for multer errors
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof Error && err.message.includes("Tipo de arquivo")) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Arquivo excede o limite de 5MB" });
  }
  next(err);
});

export default router;
