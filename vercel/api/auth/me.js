// GET /api/auth/me → dados da conta da sessão.
import { protegido, json, publico } from '../../lib/http.js';
export default protegido(['GET'], (req, res, u) => json(res, 200, publico(u)));
