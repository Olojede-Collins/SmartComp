import { postgrestSelect, type Equipment } from './supabase';

export type { Equipment };

let cachedEquipmentList: Equipment[] | null = null;
const cachedEquipmentMap = new Map<string, Equipment>();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

export function _clearEquipmentCache(): void {
  cachedEquipmentList = null;
  cachedEquipmentMap.clear();
}

export function _setLastKnownGoodEquipment(items: Equipment[]): void {
  cachedEquipmentList = [...items];
  cachedEquipmentMap.clear();
  for (const item of items) {
    if (item && item.id) {
      cachedEquipmentMap.set(item.id, item);
    }
  }
}

export async function getEquipment(): Promise<Equipment[]> {
  try {
    const data = await postgrestSelect<Equipment[]>('equipment', {
      order: 'created_at.desc',
    });
    if (Array.isArray(data)) {
      cachedEquipmentList = [...data];
      for (const item of data) {
        if (item && item.id) {
          cachedEquipmentMap.set(item.id, item);
        }
      }
      return data;
    }
    return [...(cachedEquipmentList ?? [])];
  } catch {
    return [...(cachedEquipmentList ?? [])];
  }
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  if (!isValidUuid(id)) {
    return null;
  }
  const cleanId = id.trim();
  try {
    const items = await postgrestSelect<Equipment[]>('equipment', {
      id: `eq.${cleanId}`,
      select: '*',
    });
    if (Array.isArray(items) && items.length > 0) {
      const item = items[0];
      cachedEquipmentMap.set(cleanId, item);
      return item;
    }
    return null;
  } catch {
    const fromMap = cachedEquipmentMap.get(cleanId);
    if (fromMap) {
      return fromMap;
    }
    if (cachedEquipmentList) {
      const found = cachedEquipmentList.find((i) => i.id === cleanId);
      if (found) {
        cachedEquipmentMap.set(cleanId, found);
        return found;
      }
    }
    return null;
  }
}
