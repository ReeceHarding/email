/**
 * Types for Brave Search API responses
 */

export interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
    total?: number;
    more_results_available?: boolean;
  };
  query?: {
    original?: string;
    show_strict_warning?: boolean;
    altered?: string;
    bad_query?: boolean;
    is_navigational?: boolean;
  };
  mixed?: {
    type?: string;
    content?: any[];
  }[];
  news?: {
    results?: BraveNewsResult[];
  };
  locations?: {
    results?: BraveLocationResult[];
  };
  videos?: {
    results?: BraveVideoResult[];
  };
  error?: {
    status?: string;
    code?: number;
    message?: string;
  };
}

export interface BraveWebResult {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  age?: string;
  language?: string;
  family_friendly?: boolean;
  site_categories?: string[];
  deep_links?: BraveDeepLink[];
  extra_snippets?: string[];
  related_queries?: string[];
}

export interface BraveDeepLink {
  url: string;
  title: string;
  description?: string;
}

export interface BraveNewsResult {
  url: string;
  title: string;
  description: string;
  thumbnail?: {
    src: string;
    alt?: string;
  };
  source: string;
  age: string;
}

export interface BraveLocationResult {
  name: string;
  address: string;
  source_url: string;
  phone?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  rating_count?: number;
  hours?: {
    [day: string]: string;
  };
}

export interface BraveVideoResult {
  url: string;
  title: string;
  description?: string;
  thumbnail: string;
  source: string;
  age?: string;
  duration?: string;
} 