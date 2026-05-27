import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  app_metadata?: { role?: string };
  user_metadata?: { role?: string; full_name?: string };
}

export interface AuthContext {
  supabaseUserId: string;
  email?: string;
  /** Resolved application role; defaults to SALES when using dev bypass */
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Verifies Supabase-issued JWTs (HS256 with project JWT secret).
   * Maps `app_metadata.role` / `user_metadata.role` to our Role enum when present.
   */
  verifyBearerToken(token: string): AuthContext {
    const authDisabled = this.config.get<string>('AUTH_DISABLED') === 'true';
    if (authDisabled) {
      const devRole = (this.config.get<string>('DEV_ROLE') ?? 'SALES') as keyof typeof Role;
      const mapped = Role[devRole] ?? Role.SALES;
      return {
        supabaseUserId: 'dev-user',
        email: 'dev@local',
        role: mapped,
      };
    }

    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('SUPABASE_JWT_SECRET is not configured');
    }

    try {
      const decoded = jwt.verify(token, secret) as SupabaseJwtPayload;
      const rawRole =
        decoded.app_metadata?.role ??
        decoded.user_metadata?.role ??
        decoded.role ??
        'SALES';
      const role = this.normalizeRole(String(rawRole));
      return {
        supabaseUserId: decoded.sub,
        email: decoded.email,
        role,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private normalizeRole(value: string): Role {
    const upper = value.toUpperCase();
    if (upper === 'ADMIN' || upper === 'SERVICE_ROLE') return Role.ADMIN;
    if (upper === 'ACCOUNTANT') return Role.ACCOUNTANT;
    return Role.SALES;
  }
}
