// PUT /api/perfil → nome, cargo, OAB, telefone, escritório e cidade da própria conta.
import { q } from '../lib/db.js';
import { protegido, json, corpo, publico } from '../lib/http.js';
const CAMPOS = ['nome', 'cargo', 'oab', 'telefone', 'escritorio', 'cidade'];
export default protegido(['PUT'], async (req, res, u) => {
  const b = await corpo(req), v = CAMPOS.map(c => b[c] == null ? null : String(b[c]).slice(0, 160).trim());
  if (v[0] === '') v[0] = null;
  const [n] = await q(`UPDATE usuarios SET nome = COALESCE($1, nome), cargo = $2, oab = $3, telefone = $4, escritorio = $5, cidade = $6 WHERE id = $7 RETURNING *`, [...v, u.id]);
  return json(res, 200, publico(n));
});
