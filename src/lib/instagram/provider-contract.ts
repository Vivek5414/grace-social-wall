import type {
  InstagramDateRange,
  InstagramDiscoveryProviderId,
  InstagramDiscoveryResponse,
} from "./types";

export interface InstagramProviderSearchInput {
  hashtag: string;
  dateRange: InstagramDateRange;
  page: "initial" | "next";
  recentAfter?: string;
  topAfter?: string;
}

export interface InstagramHashtagProvider {
  readonly id: InstagramDiscoveryProviderId;
  search(input: InstagramProviderSearchInput): Promise<InstagramDiscoveryResponse>;
}

export class InstagramProviderError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "InstagramProviderError";
  }
}
