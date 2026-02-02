import { create } from "zustand";
import { Equipment, Category } from "./types";
import { getEquipmentFn, getCategoriesFn, type EquipmentFilters } from "@/lib/equipment";

interface EquipmentStore {
  // State
  equipment: Equipment[];
  categories: Category[];
  filteredEquipment: Equipment[];
  selectedCategoryId: string;
  selectedAvailability: 'all' | 'available' | 'unavailable';
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  viewMode: string;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalItems: number;

  // Actions
  setSelectedCategoryId: (categoryId: string) => void;
  setSelectedAvailability: (availability: 'all' | 'available' | 'unavailable') => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: string) => void;
  setCurrentPage: (page: number) => void;
  clearFilters: () => void;
  loadEquipment: () => Promise<void>;
  loadCategories: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useEquipmentStore = create<EquipmentStore>((set, get) => ({
  // Initial state
  equipment: [],
  categories: [],
  filteredEquipment: [],
  selectedCategoryId: "",
  selectedAvailability: "all",
  searchQuery: "",
  isLoading: false,
  error: null,
  viewMode: typeof window !== 'undefined' 
    ? localStorage.getItem('equipment-view-mode') || 'grid'
    : 'grid',
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,

  // Actions
  setSelectedCategoryId: (categoryId) => {
    set({ selectedCategoryId: categoryId, currentPage: 1 });
    get().loadEquipment();
  },

  setSelectedAvailability: (availability) => {
    set({ selectedAvailability: availability, currentPage: 1 });
    get().loadEquipment();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query, currentPage: 1 });
    // The actual search will be triggered by the debounced effect in the component
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
    // Persist view mode to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('equipment-view-mode', mode);
    }
  },

  setCurrentPage: (page) => {
    set({ currentPage: page });
    get().loadEquipment();
  },

  clearFilters: () => {
    set({ 
      selectedCategoryId: "", 
      selectedAvailability: "all",
      searchQuery: "",
      currentPage: 1 
    });
    get().loadEquipment();
  },

  loadEquipment: async () => {
    const { selectedCategoryId, selectedAvailability, searchQuery, currentPage } = get();
    set({ isLoading: true, error: null });

    try {
      const filters: EquipmentFilters = {
        page: currentPage,
        limit: 20,
        sortBy: 'modelName',
        sortOrder: 'asc',
      };

      // Apply availability filter
      if (selectedAvailability === 'available') {
        filters.isActive = true;
      } else if (selectedAvailability === 'unavailable') {
        filters.isActive = false;
      }
      // If 'all', don't set isActive filter

      if (selectedCategoryId) {
        filters.categoryId = parseInt(selectedCategoryId, 10);
      }

      if (searchQuery.trim()) {
        filters.searchQuery = searchQuery.trim();
      }

      const response = await getEquipmentFn({ data: filters });
      
      if (response) {
        set({
          equipment: response.data,
          filteredEquipment: response.data,
          totalPages: response.pagination.totalPages,
          totalItems: response.pagination.total,
          isLoading: false,
        });
      } else {
        set({ 
          equipment: [], 
          filteredEquipment: [], 
          totalPages: 1, 
          totalItems: 0, 
          isLoading: false 
        });
      }
    } catch (error) {
      console.error("Failed to load equipment:", error);
      // Don't show error for empty database, just show empty state
      set({
        equipment: [], 
        filteredEquipment: [], 
        totalPages: 1, 
        totalItems: 0,
        isLoading: false,
      });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await getCategoriesFn();
      if (categories) {
        set({ categories });
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  },

  initialize: async () => {
    await Promise.all([
      get().loadCategories(),
      get().loadEquipment(),
    ]);
  },
}));
