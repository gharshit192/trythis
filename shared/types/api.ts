// API Response Types
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// User Types
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  bio?: string;
  preferences?: {
    categories?: string[];
    notifications?: {
      enabled: boolean;
      frequency: 'realtime' | 'daily' | 'weekly';
    };
    theme?: 'light' | 'dark';
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: Omit<User, 'createdAt' | 'updatedAt'>;
  token: string;
}

// Save Types
export interface Save {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  url?: string;
  image?: string;
  source: 'url' | 'instagram' | 'screenshot';
  category: 'travel' | 'shopping' | 'food' | 'experience' | 'general';
  metadata?: {
    price?: string;
    location?: string;
    domain?: string;
    ogData?: Record<string, any>;
  };
  collections?: string[];
  tags?: string[];
  notes?: string;
  status: 'active' | 'archived' | 'deleted';
  engagement?: {
    views: number;
    clicks: number;
    shared: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateSaveRequest {
  title: string;
  url?: string;
  sourceType?: 'url' | 'instagram' | 'screenshot';
  notes?: string;
  collectionIds?: string[];
}

// Collection Types
export interface Collection {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  saves: string[];
  isPublic: boolean;
  collaborators?: string[];
  metadata?: {
    itemCount: number;
    lastUpdated: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

// Recommendation Types
export interface Recommendation {
  _id: string;
  userId: string;
  fromSaveId: string;
  recommendedSaveId: string;
  score: number;
  reason: 'category_match' | 'domain_match' | 'price_match' | 'location_match' | 'behavioral';
  metadata?: {
    clicked: boolean;
    saved: boolean;
  };
  createdAt: string;
}

// Notification Types
export interface Notification {
  _id: string;
  userId: string;
  saveId?: string;
  message: string;
  type: 'trigger' | 'recommendation' | 'collaboration' | 'system';
  trigger?: 'WEEKEND' | 'VACATION' | 'BIRTHDAY' | 'LOCATION_CHANGE' | 'BAD_WEATHER' | 'HIGH_INTEREST';
  status: 'pending' | 'sent' | 'clicked' | 'dismissed';
  scheduledFor: string;
  sentAt?: string;
  read: boolean;
  readAt?: string;
  metadata?: {
    strength?: number;
    channel?: 'push' | 'email' | 'in_app';
  };
  createdAt: string;
  updatedAt: string;
}

// Search Types
export interface SearchQuery {
  q?: string;
  category?: string;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  domain?: string;
}

export interface SearchResponse {
  total: number;
  saves: Save[];
  filters: SearchQuery;
}

// Behavior Tracking Types
export interface UserBehavior {
  userId: string;
  saveId?: string;
  type: 'view' | 'click' | 'save' | 'share' | 'delete' | 'unsave' | 'edit';
  context?: {
    screen?: string;
    source?: string;
    referrer?: string;
  };
  metadata?: {
    timeSpent?: number;
    location?: string;
    deviceType?: string;
    userAgent?: string;
  };
  timestamp: string;
}
