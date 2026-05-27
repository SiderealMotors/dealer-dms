import { Injectable, Logger } from '@nestjs/common';
import { AuditEntityType, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AuditLogService {
  private readonly log = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an audit row. Prefer calling inside the same transaction as the mutation
   * so the log rolls back if the write fails.
   */
  async append(
    client: Tx | PrismaService,
    input: {
      entityType: AuditEntityType;
      entityId: string;
      auth: AuthContext | null;
      changes: Record<string, { from: unknown; to: unknown }>;
    },
  ): Promise<void> {
    if (Object.keys(input.changes).length === 0) {
      return;
    }
    const actor = await this.resolveActor(client, input.auth);
    try {
      await client.entityAuditLog.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          actorUserId: actor.userId,
          actorEmail: actor.email,
          changes: input.changes as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.log.error(
        `Failed to write audit log for ${input.entityType} ${input.entityId}: ${e instanceof Error ? e.message : e}`,
      );
      throw e;
    }
  }

  private async resolveActor(
    client: Tx | PrismaService,
    auth: AuthContext | null,
  ): Promise<{ userId: string | null; email: string | null }> {
    if (!auth) {
      return { userId: null, email: null };
    }
    const user = await client.user.findFirst({
      where: { supabaseUserId: auth.supabaseUserId },
      select: { id: true },
    });
    return { userId: user?.id ?? null, email: auth.email ?? null };
  }
}
