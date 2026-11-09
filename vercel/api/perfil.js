// PUT /api/perfil → nome, cargo, OAB, telefone, escritório, cidade e foto da própria conta.
// foto: data URL de imagem (JPEG/PNG/WebP, até ~400 KB); null remove; ausente mantém.
import { q } from '../lib/db.js';
import { protegido, json, corpo, publico } from '../lib/http.js';
const CAMPOS = ['nome', 'cargo', 'oab', 'telefone', 'escritorio', 'cidade'];
const FOTO_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export default protegido(['PUT'], async (req, res, u) => {
  const b = await corpo(req), v = CAMPOS.map(c => b[c] == null ? null : String(b[c]).slice(0, 160).trim());
  if (v[0] === '') v[0] = null;
  let foto = u.foto || null;
  if ('foto' in b) {
    if (b.foto == null || b.foto === '') foto = null;
    else if (typeof b.foto !== 'string' || b.foto.length > 400000 || !FOTO_OK.test(b.foto)) return json(res, 400, { erro: 'Foto inválida ou grande demais.' });
    else foto = b.foto;
  }
  const [n] = await q(`UPDATE usuarios SET nome = COALESCE($1, nome), cargo = $2, oab = $3, telefone = $4, escritorio = $5, cidade = $6, foto = $7 WHERE id = $8 RETURNING *`, [...v, foto, u.id]);
  return json(res, 200, { ...publico(n), foto: n.foto || null });
});
