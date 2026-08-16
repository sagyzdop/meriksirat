export interface Category {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number | null;
}

export interface Equipment {
  id: number;
  modelName: string;
  description: string | null;
  categoryId: number | null;
  googleCalendarId: string;
  requiredClearanceLevel: number | null;
  imagePath: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  category: Category | null;
}

export type EquipmentAvailabilityStatus =
  | 'in-booking'
  | 'checking'
  | 'unavailable'
  | 'available';