// ════════════════════════════════════════════════════════════════
// Bikers Portal — File uploads (multer + local storage)
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import multer from 'multer'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAuth } from '../auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS   = join(__dirname, '..', '..', 'data', 'uploads')
const BUCKETS   = ['avatars', 'post-images', 'bike-images']

for (const b of BUCKETS) {
  const d = join(UPLOADS, b)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

const r = Router()

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, join(UPLOADS, req.params.bucket))
  },
  filename(req, file, cb) {
    const safe = (file.originalname || 'upload').replace(/[^a-z0-9.\-_]/gi, '_')
    cb(null, `${Date.now()}-${safe}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },   // 8 MB
  fileFilter(req, file, cb) {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Only images are accepted.'))
    cb(null, true)
  }
})

// POST /api/storage/:bucket   (multipart, field: "file")
r.post('/:bucket', requireAuth, (req, res, next) => {
  if (!BUCKETS.includes(req.params.bucket)) {
    return res.status(400).json({ error: 'Unknown bucket.' })
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File exceeds 8 MB.' })
      return res.status(400).json({ error: err.message || 'Upload failed.' })
    }
    if (!req.file) return res.status(400).json({ error: 'No file provided.' })
    const url = `/uploads/${req.params.bucket}/${req.file.filename}`
    res.json({ url, path: req.file.filename, bucket: req.params.bucket, size: req.file.size })
  })
})

// DELETE /api/storage/:bucket   body: { paths: ["..."] }
r.delete('/:bucket', requireAuth, async (req, res) => {
  // (Not required by the UI; left as a hook for future cleanup.)
  res.json({ ok: true })
})

export default r
