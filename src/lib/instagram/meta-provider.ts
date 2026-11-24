import "server-only";
import { discoverInstagramHashtag } from "./graph-api";
import {
  InstagramProviderError,
  type InstagramHashtagProvider,
} from "./provider-contract";

export const metaInstagramProvider: InstagramHashtagProvider = {
  id: "meta",
  async search(input) {
    if (input.dateRange !== "24h") {
      throw new InstagramProviderError(
        400,
        "Meta Graph API recent hashtag media is limited to 24 hours. Choose 24 hours or use Apify.",
      );
    }

    const result = await discoverInstagramHashtag(input.hashtag, {
      page: input.page,
      recentAfter: input.recentAfter,
      topAfter: input.topAfter,
    });
    return {
      ...result,
      provider: "meta",
      hashtag: input.hashtag,
      dateRange: input.dateRange,
    };
  },
};
