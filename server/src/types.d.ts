import type { TokenRole } from './utils/jwt.js';
declare global {
  namespace Express {
    interface User { id: string; role: TokenRole; email: string; name: string; }
    interface Request { user?: User }
  }
}
export {};
