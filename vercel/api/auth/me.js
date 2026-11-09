// GET /api/auth/me → dados da conta da sessão (com a foto do perfil).
import { protegido, json, publico } from '../../lib/http.js';
export default protegido(['GET'], (req, res, u) => json(res, 200, { ...publico(u), foto: u.foto || null }));
