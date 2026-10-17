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

  async checkHealth(): Promise<boolean> {
    if (!this.healthy) {
      return false;
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey && process.env.NODE_ENV !== 'test') {
      try {
        const cleanUrl = supabaseUrl.replace(/\/+$/, '');
        const res = await globalThis.fetch(
          `${cleanUrl}/rest/v1/equipment?select=id&limit=1`,
          {
            method: 'GET',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
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
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey && process.env.NODE_ENV !== 'test') {
      const cleanUrl = supabaseUrl.replace(/\/+$/, '');
      const res = await globalThis.fetch(
        `${cleanUrl}/rest/v1/equipment?select=*&order=updated_at.desc&limit=15`,
        {
          method: 'GET',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
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
    const index = this.equipment.findIndex((i) => i.id === id);
    if (index === -1) {
      return null;
    }
    const current = this.equipment[index];
    const now = new Date().toISOString();
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
    return [...this.admins];
  }

  async getAdminById(id: string): Promise<AdminRecord | null> {
    const admin = this.admins.find((a) => a.id === id);
    return admin ? { ...admin } : null;
  }

  async getAdminByEmail(email: string): Promise<AdminRecord | null> {
    const admin = this.admins.find(
      (a) => a.email.toLowerCase() === email.toLowerCase(),
    );
    return admin ? { ...admin } : null;
  }

  async getPendingInviteByEmail(
    email: string,
  ): Promise<AdminInviteRecord | null> {
    const invite = this.invites.find(
      (i) =>
        i.email.toLowerCase() === email.toLowerCase() && i.accepted_at === null,
    );
    return invite ? { ...invite } : null;
  }

  async getInviteByTokenHash(
    tokenHash: string,
  ): Promise<AdminInviteRecord | null> {
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
    return [...this.auditLogs];
  }
}

export const db = new DatabaseClient();
