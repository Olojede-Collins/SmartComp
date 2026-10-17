import crypto from 'node:crypto';

export type EquipmentCondition =
  'Working' | 'Faulty' | 'Under Maintenance' | 'Decommissioned';

export interface EquipmentRecord {
  id: string;
  name: string;
  core_functionality: string | null;
  other_functionality: string | null;
  condition: EquipmentCondition;
  quantity: number;
  image_keys: string[];
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AdminRecord {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

export interface AdminInviteRecord {
  id: string;
  email: string;
  token_hash: string;
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
}

export interface AuditLogRecord {
  id: string;
  actor_admin_id: string;
  action: string;
  target: string;
  created_at: string;
}

export class DatabaseClient {
  private healthy = true;
  private equipment: EquipmentRecord[] = [];
  private admins: AdminRecord[] = [
    {
      id: 'admin-seed-id-1',
      name: 'System Administrator',
      email: 'admin@smartcomp.abu.edu.ng',
      created_at: new Date().toISOString(),
    },
  ];
  private invites: AdminInviteRecord[] = [];
  private auditLogs: AuditLogRecord[] = [];

  setHealthy(state: boolean): void {
    this.healthy = state;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  reset(data?: {
    equipment?: EquipmentRecord[];
    admins?: AdminRecord[];
    invites?: AdminInviteRecord[];
    auditLogs?: AuditLogRecord[];
  }): void {
    this.healthy = true;
    this.equipment = data?.equipment ? [...data.equipment] : [];
    this.admins = data?.admins
      ? [...data.admins]
      : [
          {
            id: 'admin-seed-id-1',
            name: 'System Administrator',
            email: 'admin@smartcomp.abu.edu.ng',
            created_at: new Date().toISOString(),
          },
        ];
    this.invites = data?.invites ? [...data.invites] : [];
    this.auditLogs = data?.auditLogs ? [...data.auditLogs] : [];
  }

  private getSupabase(): { url: string; key: string } | null {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey && process.env.NODE_ENV !== 'test') {
      return {
        url: supabaseUrl.replace(/\/+$/, ''),
        key: serviceRoleKey,
      };
    }
    return null;
  }

  private async getValidAdminId(
    sb: { url: string; key: string },
    adminId: string,
  ): Promise<string | null> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        adminId,
      )
    ) {
      return null;
    }
    try {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/admins?id=eq.${encodeURIComponent(adminId)}&select=id&limit=1`,
        {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { id: string }[];
      return data.length > 0 ? data[0].id : null;
    } catch {
      return null;
    }
  }

  private async recordAuditLog(
    sb: { url: string; key: string },
    actorAdminId: string | null,
    action: string,
    target: string,
    createdAt: string,
  ): Promise<void> {
    try {
      await globalThis.fetch(`${sb.url}/rest/v1/audit_log`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actor_admin_id: actorAdminId,
          action,
          target,
          created_at: createdAt,
        }),
      });
    } catch {}
  }

  async checkHealth(): Promise<boolean> {
    if (!this.healthy) {
      return false;
    }
    const sb = this.getSupabase();
    if (sb) {
      try {
        const res = await globalThis.fetch(
          `${sb.url}/rest/v1/equipment?select=id&limit=1`,
          {
            method: 'GET',
            headers: {
              apikey: sb.key,
              Authorization: `Bearer ${sb.key}`,
              Accept: 'application/json',
            },
          },
        );
        return res.ok;
      } catch {
        return false;
      }
    }
    return this.healthy;
  }

  async getEquipment(): Promise<EquipmentRecord[]> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/equipment?select=*&order=updated_at.desc&limit=15`,
        {
          method: 'GET',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      return (await res.json()) as EquipmentRecord[];
    }
    return [...this.equipment].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }

  async getEquipmentById(id: string): Promise<EquipmentRecord | null> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/equipment?id=eq.${encodeURIComponent(id)}&select=*`,
        {
          method: 'GET',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      const data = (await res.json()) as EquipmentRecord[];
      return data.length > 0 ? { ...data[0] } : null;
    }
    const item = this.equipment.find((i) => i.id === id);
    return item ? { ...item } : null;
  }

  async createEquipment(
    data: {
      name: string;
      core_functionality?: string | null;
      other_functionality?: string | null;
      condition: EquipmentCondition;
      quantity?: number;
      image_keys?: string[];
    },
    adminId: string,
  ): Promise<EquipmentRecord> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const now = new Date().toISOString();
    const sb = this.getSupabase();
    if (sb) {
      const validAdminId = await this.getValidAdminId(sb, adminId);
      const res = await globalThis.fetch(`${sb.url}/rest/v1/equipment`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name: data.name,
          core_functionality: data.core_functionality ?? null,
          other_functionality: data.other_functionality ?? null,
          condition: data.condition,
          quantity: data.quantity ?? 1,
          image_keys: data.image_keys ? [...data.image_keys] : [],
          created_at: now,
          updated_at: now,
          updated_by: validAdminId,
        }),
      });
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      const created = (await res.json()) as EquipmentRecord[];
      return { ...created[0] };
    }
    const item: EquipmentRecord = {
      id: crypto.randomUUID(),
      name: data.name,
      core_functionality: data.core_functionality ?? null,
      other_functionality: data.other_functionality ?? null,
      condition: data.condition,
      quantity: data.quantity ?? 1,
      image_keys: data.image_keys ? [...data.image_keys] : [],
      created_at: now,
      updated_at: now,
      updated_by: adminId,
    };
    this.equipment.push(item);
    return { ...item };
  }

  async updateEquipment(
    id: string,
    updates: Partial<Omit<EquipmentRecord, 'id' | 'created_at'>>,
    adminId: string,
  ): Promise<EquipmentRecord | null> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const now = new Date().toISOString();
    const sb = this.getSupabase();
    if (sb) {
      const validAdminId = await this.getValidAdminId(sb, adminId);
      const patchBody: Record<string, unknown> = {
        ...updates,
        updated_at: now,
      };
      if (validAdminId) {
        patchBody.updated_by = validAdminId;
      }
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/equipment?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(patchBody),
        },
      );
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      const data = (await res.json()) as EquipmentRecord[];
      return data.length > 0 ? { ...data[0] } : null;
    }
    const index = this.equipment.findIndex((i) => i.id === id);
    if (index === -1) {
      return null;
    }
    const current = this.equipment[index];
    const updated: EquipmentRecord = {
      ...current,
      ...updates,
      updated_at: now,
      updated_by: adminId,
    };
    this.equipment[index] = updated;
    return { ...updated };
  }

  async deleteEquipment(id: string): Promise<boolean> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/equipment?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Prefer: 'return=representation',
          },
        },
      );
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      const data = (await res.json()) as EquipmentRecord[];
      return data.length > 0;
    }
    const index = this.equipment.findIndex((i) => i.id === id);
    if (index === -1) {
      return false;
    }
    this.equipment.splice(index, 1);
    return true;
  }

  async getAdmins(): Promise<AdminRecord[]> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/admins?select=*&order=created_at.asc`,
        {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      return (await res.json()) as AdminRecord[];
    }
    return [...this.admins];
  }

  async getAdminById(id: string): Promise<AdminRecord | null> {
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/admins?id=eq.${encodeURIComponent(id)}&select=*`,
        {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AdminRecord[];
      return data.length > 0 ? { ...data[0] } : null;
    }
    const admin = this.admins.find((a) => a.id === id);
    return admin ? { ...admin } : null;
  }

  async getAdminByEmail(email: string): Promise<AdminRecord | null> {
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/admins?email=ilike.${encodeURIComponent(email)}&select=*`,
        {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AdminRecord[];
      return data.length > 0 ? { ...data[0] } : null;
    }
    const admin = this.admins.find(
      (a) => a.email.toLowerCase() === email.toLowerCase(),
    );
    return admin ? { ...admin } : null;
  }

  async getPendingInviteByEmail(
    email: string,
  ): Promise<AdminInviteRecord | null> {
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/admin_invites?email=ilike.${encodeURIComponent(email)}&accepted_at=is.null&select=*`,
        {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AdminInviteRecord[];
      return data.length > 0 ? { ...data[0] } : null;
    }
    const invite = this.invites.find(
      (i) =>
        i.email.toLowerCase() === email.toLowerCase() && i.accepted_at === null,
    );
    return invite ? { ...invite } : null;
  }

  async getInviteByTokenHash(
    tokenHash: string,
  ): Promise<AdminInviteRecord | null> {
    const sb = this.getSupabase();
    if (sb) {
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/admin_invites?token_hash=eq.${encodeURIComponent(tokenHash)}&select=*`,
        {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AdminInviteRecord[];
      return data.length > 0 ? { ...data[0] } : null;
    }
    const invite = this.invites.find((i) => i.token_hash === tokenHash);
    return invite ? { ...invite } : null;
  }

  async createInvite(
    email: string,
    invitedBy: string,
  ): Promise<{ invite: AdminInviteRecord; token: string }> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();
    const sb = this.getSupabase();
    if (sb) {
      const validInvitedBy = await this.getValidAdminId(sb, invitedBy);
      const res = await globalThis.fetch(`${sb.url}/rest/v1/admin_invites`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          email,
          token_hash: tokenHash,
          invited_by: validInvitedBy,
          created_at: now,
          accepted_at: null,
        }),
      });
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      const created = (await res.json()) as AdminInviteRecord[];
      await this.recordAuditLog(sb, validInvitedBy, 'admin.invite', email, now);
      return { invite: { ...created[0] }, token };
    }
    const invite: AdminInviteRecord = {
      id: crypto.randomUUID(),
      email,
      token_hash: tokenHash,
      invited_by: invitedBy,
      created_at: now,
      accepted_at: null,
    };
    this.invites.push(invite);
    this.auditLogs.push({
      id: crypto.randomUUID(),
      actor_admin_id: invitedBy,
      action: 'admin.invite',
      target: email,
      created_at: now,
    });
    return { invite: { ...invite }, token };
  }

  async acceptInvite(
    tokenHash: string,
    name?: string,
  ): Promise<AdminRecord | null> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const sb = this.getSupabase();
    if (sb) {
      const invite = await this.getInviteByTokenHash(tokenHash);
      if (!invite) {
        return null;
      }
      if (invite.accepted_at !== null) {
        throw new Error('already-accepted');
      }
      const now = new Date().toISOString();
      await globalThis.fetch(
        `${sb.url}/rest/v1/admin_invites?id=eq.${encodeURIComponent(invite.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accepted_at: now }),
        },
      );
      const adminId = crypto.randomUUID();
      const adminRes = await globalThis.fetch(`${sb.url}/rest/v1/admins`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id: adminId,
          name: name ?? null,
          email: invite.email,
          created_at: now,
        }),
      });
      if (!adminRes.ok) {
        throw new Error(`PostgREST error: ${adminRes.status}`);
      }
      const admins = (await adminRes.json()) as AdminRecord[];
      await this.recordAuditLog(sb, adminId, 'admin.accept', invite.email, now);
      return { ...admins[0] };
    }
    const inviteIndex = this.invites.findIndex(
      (i) => i.token_hash === tokenHash,
    );
    if (inviteIndex === -1) {
      return null;
    }
    const invite = this.invites[inviteIndex];
    if (invite.accepted_at !== null) {
      throw new Error('already-accepted');
    }
    const now = new Date().toISOString();
    invite.accepted_at = now;
    const adminId = crypto.randomUUID();
    const newAdmin: AdminRecord = {
      id: adminId,
      name: name ?? null,
      email: invite.email,
      created_at: now,
    };
    this.admins.push(newAdmin);
    this.auditLogs.push({
      id: crypto.randomUUID(),
      actor_admin_id: adminId,
      action: 'admin.accept',
      target: invite.email,
      created_at: now,
    });
    return { ...newAdmin };
  }

  async deleteAdmin(
    id: string,
    actorAdminId: string,
  ): Promise<{ success: boolean; lastAdmin?: boolean; notFound?: boolean }> {
    if (!this.healthy) {
      throw new Error('Database unreachable');
    }
    const sb = this.getSupabase();
    if (sb) {
      const admins = await this.getAdmins();
      const admin = admins.find((a) => a.id === id);
      if (!admin) {
        return { success: false, notFound: true };
      }
      if (admins.length <= 1) {
        return { success: false, lastAdmin: true };
      }
      const res = await globalThis.fetch(
        `${sb.url}/rest/v1/admins?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
          },
        },
      );
      if (!res.ok) {
        throw new Error(`PostgREST error: ${res.status}`);
      }
      const validActor = await this.getValidAdminId(sb, actorAdminId);
      const now = new Date().toISOString();
      await this.recordAuditLog(
        sb,
        validActor,
        'admin.remove',
        admin.email,
        now,
      );
      return { success: true };
    }
    const adminIndex = this.admins.findIndex((a) => a.id === id);
    if (adminIndex === -1) {
      return { success: false, notFound: true };
    }
    if (this.admins.length <= 1) {
      return { success: false, lastAdmin: true };
    }
    const removed = this.admins.splice(adminIndex, 1)[0];
    const now = new Date().toISOString();
    this.auditLogs.push({
      id: crypto.randomUUID(),
      actor_admin_id: actorAdminId,
      action: 'admin.remove',
      target: removed.email,
      created_at: now,
    });
    return { success: true };
  }

  async getAuditLogs(): Promise<AuditLogRecord[]> {
    const sb = this.getSupabase();
    if (sb) {
      try {
        const res = await globalThis.fetch(
          `${sb.url}/rest/v1/audit_log?select=*&order=created_at.desc`,
          {
            headers: {
              apikey: sb.key,
              Authorization: `Bearer ${sb.key}`,
              Accept: 'application/json',
            },
          },
        );
        if (res.ok) {
          return (await res.json()) as AuditLogRecord[];
        }
      } catch {}
    }
    return [...this.auditLogs];
  }
}

export const db = new DatabaseClient();
