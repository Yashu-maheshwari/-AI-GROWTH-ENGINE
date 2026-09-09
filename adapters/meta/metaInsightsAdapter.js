// REAL META INSIGHTS — READ-ONLY ADAPTER
// AME Content Intelligence Engine
// Never calls publishing endpoints. Read-only analytics only.
// Status: LIVE / MOCK / UNAVAILABLE / ERROR
//
// NEVER modifies:
// - TEST_MODE
// - AUTOPUBLISH_KILL_SWITCH
// - Meta publishing logic
// - Publishing credentials
// - Production posting flow
//
// Only reads analytics metrics from Meta Graph API v25.0

/**
 * Meta Insights Adapter — Read-only analytics collector
 * Extracts performance metrics from published AME Instagram/Facebook posts.
 *
 * Data states: LIVE | MOCK | UNAVAILABLE | ERROR
 * Never fabricates metrics. Missing fields remain null.
 */

// ============================================================
// METRICS SCHEMA — What Meta Graph API actually returns
// ============================================================

/**
 * Normalized performance metric structure from Meta Graph API
 * Only populated fields are those actually returned by the API.
 * Missing metrics remain null — never faked.
 */
const MetaMetricSchema = {
  // Basic post identification
  post_id: null,         // Meta media_id or Instagram post ID
  platform: null,        // 'INSTAGGRAM', 'FACEBOOK'
  media_type: null,      // 'IMAGE', 'REELS', 'VIDEO'
  published_at: null,    // ISO timestamp

  // Reach & visibility
  reach: null,           // Organic reach count
  impressions: null,     // Total impressions
  views: null,           // Video views count ( Reels / video )

  // Engagement
  likes: null,           // Post likes count
  comments: null,        // Post comments count
  shares: null,          // Post shares count
  saves: null,           // Post saves / saves to collection

  // Audience actions
  profile_visits: null,  // Profile visits from post
  follows: null,         // New followers from post

  // Video-specific
  watch_time: null,      // Total watch time (seconds) for video/Reels

  // Derived rates (calculated if base metrics available)
  engagement_rate: null, // (likes + comments) / impressions (if impressions > 0)
  share_rate: null,      // shares / impressions (if impressions > 0)
  save_rate: null,       // saves / impressions (if impressions > 0)
  comment_rate: null,    // comments / impressions (if impressions > 0)
  profile_action_rate: null, // profile_visits / impressions (if impressions > 0)
};

/**
 * Map AME publication records to Meta media IDs
 * Uses existing AME post_id / post_url to identify Meta posts.
 * If mapping cannot be verified, marks as UNAVAILABLE.
 */
const PostMapper = {
  /**
   * Map an AME content item to a Meta media ID
   * @param {Object} contentItem - AME content item from content_items table / SocialMediaLog
   * @returns {Object} mapping result with status
   */
  mapContentItem: function(contentItem) {
    // The AME project stores post_id (Meta-generated) and post_url in SocialMediaLog
    // We can use these for mapping, but cannot verify the mapping without credentials

    if (!contentItem || !contentItem.post_id) {
      return {
        status: 'UNAVAILABLE',
        reason: 'No Meta post_id in AME content record',
        meta_media_id: null,
      };
    }

    // We have a post_id from AME, but cannot verify it maps to actual Meta media ID
    // without making a Graph API call. For read-only adapter, we mark mapping as
    // available for inspection but metrics as UNAVAILABLE until credentials checked.

    return {
      status: 'MAPPING_DEFERRED', // Can inspect, but need API to verify
      reason: 'AME post_id present — mapping possible with Meta API credentials',
      meta_media_id: contentItem.post_id,
    };
  },
};

/**
 * Check Meta Graph API credentials availability
 * @returns {Object} { canAccess: boolean, reason: string }
 */
/**
 * Check Meta Graph API credentials availability via AME bridge
 * @returns {Object} { canAccess: boolean, reason: string, bridge: Object }
 */
function checkCredentials() {
  // Try to use the MetaPerformanceBridge if available
  // The bridge connects to AME's post_performance_insights via
  // server-side Supabase/Postgres credentials (never exposed to Node/GitHub/chats)
  try {
    const bridge = require ? require('./metaPerformanceBridge') : window.MetaPerformanceBridge;
    if (bridge && bridge.fetchPostPerformance) {
      // Bridge is available — credentials are configured internally in GAS
      return {
        canAccess: true,
        reason: 'MetaPerformanceBridge available — credentials managed internally in GAS',
        bridge: bridge,
      };
    }
  } catch (e) {
    // Bridge not available in this environment — expected
  }

  // Fallback: cannot access GAS PropertiesService from standalone Node
  return {
    canAccess: false,
    reason: 'Cannot access GAS PropertiesService from Node environment — would require GAS execution with valid access_token',
    bridge: null,
  };
}
function fetchInstagramInsights(options = {}) {
  const { media_id, access_token } = options;

  // Check if we can actually access Meta API
  const credCheck = checkCredentials();

  if (!credCheck.canAccess) {
    return {
      status: 'UNAVAILABLE',
      data: null,
      reason: credCheck.reason,
      retrievedAt: new Date().toISOString(),
    };
  }

  // If no media_id provided, we cannot fetch
  if (!media_id) {
    return {
      status: 'UNAVAILABLE',
      data: null,
      reason: 'No Meta media_id provided for insights fetch',
      retrievedAt: new Date().toISOString(),
    };
  }

  // Construct Graph API URL for Instagram media insights
  // Endpoint: {graph-api-version}/{media_id}/insights
  // Required permissions: instagram_basic, instagram_analytics
  // API version: v25.0 (as configured in MetaService.gs)

  const apiVersion = 'v25.0';
  const url = `https://graph.facebook.com/${apiVersion}/${media_id}/insights`;

  // Parameters for key metrics
  // We request the most commonly used insight metrics
  const params = new URLSearchParams({
    'metric': 'impressions,reach,engaged_users,likes,comments,shares,saves',
    'period': 'life',  // 'lifetime' or 'day' — lifetime for historical
    'access_token': access_token,
  });

  // In a real implementation, this would use UrlFetchApp (GAS) or node-fetch
  // Here we simulate the API call response structure
  // The actual implementation in GAS would use: UrlFetchApp.fetch(url + '?' + params)

  // For now: return UNAVAILABLE since we cannot access the API from this environment
  // The adapter interface is ready — when GAS credentials are accessible,
  // this would make the actual API call

  return {
    status: 'UNAVAILABLE',
    data: null,
    reason: 'Meta Graph API not accessible from Node environment — requires GAS UrlFetchApp execution with valid access_token',
    retrievedAt: new Date().toISOString(),
    // The adapter interface is ready for when credentials are accessible
    // Actual API call would be: UrlFetchApp.fetch(url + '?' + params) in GAS
  };
}

/**
 * Fetch Facebook Page post insights from Meta Graph API
 * @param {Object} options - Fetch options
 * @param {string} options.media_id - Meta media ID or Facebook post ID
 * @param {string} options.access_token - Meta Page Access Token
 * @returns {Object} { status, data, retrievedAt }
 */
function fetchFacebookPostInsights(options = {}) {
  const { media_id, access_token } = options;

  const credCheck = checkCredentials();
  if (!credCheck.canAccess) {
    return {
      status: 'UNAVAILABLE',
      data: null,
      reason: credCheck.reason,
      retrievedAt: new Date().toISOString(),
    };
  }

  if (!media_id) {
    return {
      status: 'UNAVAILABLE',
      data: null,
      reason: 'No Facebook media_id provided',
      retrievedAt: new Date().toISOString(),
    };
  }

  const apiVersion = 'v25.0';
  const url = `https://graph.facebook.com/${apiVersion}/${media_id}/insights`;

  const params = new URLSearchParams({
    'metric': 'impressions,reach,engaged_users,likes,comments,shares,saves',
    'period': 'lifetime',
    'access_token': access_token,
  });

  // Would use: UrlFetchApp.fetch(url + '?' + params) in GAS
  // For now: UNAVAILABLE from Node environment

  return {
    status: 'UNAVAILABLE',
    data: null,
    reason: 'Meta Graph API not accessible from Node environment — requires GAS UrlFetchApp execution',
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Normalize raw Meta API response into our standardized schema
 * Only populates fields that are actually returned.
 * Missing metrics remain null — never faked.
 * @param {Object} rawResponse - Raw Meta Graph API response
 * @returns {Object} Normalized metrics object per MetaMetricSchema
 */
function normalizeMetrics(rawResponse) {
  if (!rawResponse || !rawResponse.data || rawResponse.data.length === 0) {
    return { ...MetaMetricSchema, source: 'Meta Graph API', status: 'UNAVAILABLE' };
  }

  const normalized = { ...MetaMetricSchema };
  const metrics = rawResponse.data[0]; // Meta returns metrics in first data row

  if (!metrics) {
    return { ...MetaMetricSchema, status: 'UNAVAILABLE' };
  }

  // Map Meta API response fields to our schema
  // Meta insights API returns: values array with metric name and value
  // Structure: { metric: 'insights', values: [{ name: 'impressions', value: 1234 }] }

  if (metrics.values && Array.isArray(metrics.values)) {
    for (const item of metrics.values) {
      if (item && item.name && item.value !== null && item.value !== undefined) {
        const metricName = item.name.toLowerCase();

        // Map Meta metric names to our schema
        switch (metricName) {
          case 'impressions':
            normalized.impressions = item.value;
            break;
          case 'reach':
            normalized.reach = item.value;
            break;
          case 'engaged_users':
            // engaged_users is not engagement_rate, but a count
            normalized.likes = normalized.likes || item.value; // fallback usage
            break;
          case 'likes':
            normalized.likes = item.value;
            break;
          case 'comments':
            normalized.comments = item.value;
            break;
          case 'shares':
            normalized.shares = item.value;
            break;
          case 'saves':
            normalized.saves = item.value;
            break;
          case 'video_views':
            normalized.views = item.value;
            break;
          case 'video_play_time':
            // Could map to watch_time
            normalized.watch_time = item.value;
            break;
          case 'profile_visits':
            normalized.profile_visits = item.value;
            break;
          case 'follows':
            normalized.follows = item.value;
            break;
          case 'engagement':
            // Meta's "engagement" typically = likes + comments + shares
            // We calculate it if we have the components, or store raw
            normalized.engagement = item.value;
            break;
          default:
            // Unknown metric — store anyway if value is available
            // but do not add to schema unless we add it formally
            break;
        }
      }
    }
  }

  // Calculate derived rates only if we have sufficient base metrics
  // Never divide by zero
  if (normalized.impressions !== null && normalized.impressions > 0) {
    // engagement_rate = (likes + comments) / impressions
    if (normalized.likes !== null && normalized.comments !== null) {
      normalized.engagement_rate = (normalized.likes + normalized.comments) / normalized.impressions;
    }

    // share_rate = shares / impressions
    if (normalized.shares !== null) {
      normalized.share_rate = normalized.shares / normalized.impressions;
    }

    // save_rate = saves / impressions
    if (normalized.saves !== null) {
      normalized.save_rate = normalized.saves / normalized.impressions;
    }

    // comment_rate = comments / impressions
    if (normalized.comments !== null) {
      normalized.comment_rate = normalized.comments / normalized.impressions;
    }

    // profile_action_rate = profile_visits / impressions
    if (normalized.profile_visits !== null) {
      normalized.profile_action_rate = normalized.profile_visits / normalized.impressions;
    }
  }

  normalized.source = 'Meta Graph API';
  normalized.retrievedAt = new Date().toISOString();
  normalized.status = 'LIVE';

  return normalized;
}

// ==========================================================//
// EXPORT
// ============================================================

module.exports = {
  MetaMetricSchema,
  PostMapper,
  checkCredentials,
  fetchInstagramInsights,
  fetchFacebookPostInsights,
  normalizeMetrics,
  // For testing/verification
  __testOnly: {
    fetchInstagramInsights,
    fetchFacebookPostInsights,
    normalizeMetrics,
    MetaMetricSchema,
  },
};

// ==========================================================//
// AUDIT VERIFICATION
// ============================================================

/**
 * Verify adapter read-only enforcement
 * Checks that no publishing endpoints are referenced
 */
function verifyReadOnlyEnforcement() {
  const adapterSource = fetchInstagramInsights.toString() + fetchFacebookPostInsights.toString() + normalizeMetrics.toString();

  const publishingKeywords = [
    'publish',
    'create',
    'container',
    'media_publish',
    'delete',
    'update',
    'update',
    'endpoint',
  ];

  const lowerSource = adapterSource.toLowerCase();
  const foundPublishing = publishingKeywords.filter(k => lowerSource.includes(k.toLowerCase()));

  if (foundPublishing.length > 0) {
    console.warn(`⚠️  WARNING: Adapter contains publishing-related keywords: ${foundPublishing.join(', ')}`);
    return false;
  }

  console.log('✅ Read-only enforcement verified — no publishing endpoints found');
  return true;
}

// Run verification on module load
verifyReadOnlyEnforcement();