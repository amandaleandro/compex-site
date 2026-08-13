const { z } = require('zod');

// Validações leves para as rotas de maior risco (auth, financeiro, uploads).
// Mensagens em português são propositalmente específicas — não são erros internos vazando.

const loginSchema = z.object({
  email: z.string({ error: 'E-mail é obrigatório.' }).trim().min(1, 'E-mail é obrigatório.'),
  password: z.string({ error: 'Senha é obrigatória.' }).min(1, 'Senha é obrigatória.'),
});

const transactionCreateSchema = z.object({
  description: z.string({ error: 'Descrição é obrigatória.' }).trim().min(1, 'Descrição é obrigatória.'),
  amount: z.coerce.number({ error: 'Valor deve ser um número positivo.' }).positive('Valor deve ser um número positivo.'),
  type: z.enum(['income', 'expense'], { error: "Tipo deve ser 'income' ou 'expense'." }),
  category: z.string().trim().min(1).optional(),
});

const transactionUpdateSchema = z.object({
  id: z.union([z.string(), z.number()]).refine(v => String(v).trim().length > 0, 'Informe o id do lançamento.'),
  description: z.string().trim().min(1, 'Descrição não pode ser vazia.').optional(),
  amount: z.coerce.number({ error: 'Valor deve ser um número positivo.' }).positive('Valor deve ser um número positivo.').optional(),
  type: z.enum(['income', 'expense'], { error: "Tipo deve ser 'income' ou 'expense'." }).optional(),
  category: z.string().trim().min(1).optional(),
});

// Retorna { ok:true, data } ou { ok:false, message } com a primeira mensagem de erro do schema.
function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  const message = result.error.issues[0]?.message || 'Dados inválidos.';
  return { ok: false, message };
}

// Allowlists de mimetype para uploads.
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const NEWS_MEDIA_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, 'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  ...IMAGE_MIME_TYPES,
]);

function isAllowedMime(mimeType, allowlist) {
  return typeof mimeType === 'string' && allowlist.has(mimeType.toLowerCase());
}

module.exports = {
  loginSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  validate,
  IMAGE_MIME_TYPES,
  NEWS_MEDIA_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  isAllowedMime,
};
