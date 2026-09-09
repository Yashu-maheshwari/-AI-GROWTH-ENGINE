/**
 * AME Meta Performance Data Bridge
 * 
 * Read-only bridge that extracts normalized performance metrics
 * from the existing post_performance_insights table in AME's Supabase/Postgres database.
 * 
 * Never calls Meta Graph API. Never writes publishing actions.
 * Never exposes access tokens. All data already cached from prior GAS sync.
 * 
 * Data states: LIVE | UNAVAILABLE | ERROR
 * Missing metrics remain null — never fabricated.
 */

const MetaPerformanceBridge = {
  /**
   * Fetch normalized performance data from post_performance_insights for a specific post
   * @param {Object} options - Fetch options
   * @param {string} options.platform_post_id - The Meta platform post ID
   * @param {string} options.platform - Platform name (INSTAGRAM_FEED, INSTAGRAM_STORY, FACEBOOK_PAGE, etc.)
   * @returns {Object} { status, data, error, retrievedAt }
   */
  fetchPostPerformance: function(options = {}) {
    const { platform_post_id, platform } = options;

    if (!platform_post_id) {
      return {
        status: 'UNAVAILABLE',
        data: null,
        error: 'No platform_post_id provided',
        retrievedAt: new Date().toISOString(),
      };
    }

    // SQL to fetch one real post's performance data
    // Using parameterized query pattern — in real GAS/Node environment
    // this would connect to Supabase/Postgres via existing AME credentials
    // that are stored server-side, NOT exposed to Node/GitHub/chats
    const sql = `
      SELECT platform_post_id, platform, published_at, reach, impressions, likes, comments, shares, saves,
             facebook_clicks, total_interactions, collection_status, collected_at, api_version
      FROM post_performance_insights
      WHERE platform_post_id = $1 AND platform = $2
      ORDER BY collected_at DESC LIMIT 1
    `;

    // NOTE: This SQL query pattern represents the read-only extraction.
    // The actual database connection uses AME's existing Supabase credentials
    // that remain on the server side — no token exposure to Node environment.
    // 
    // In the real AME GAS execution environment, this would use:
    // - Jdbc connection via PropertiesService (DB_URL, DB_USER, DB_PASS)
    // - Or Supabase JS SDK with service_role key (server-side only)
    //
    // This adapter only runs in contexts where those server-side credentials
    // are available — never in standalone Node that could expose tokens.

    // For now, return the interface structure that will be populated
    // when connected to the actual database bridge.
    return {
      status: 'UNAVAILABLE',
      data: null,
      error: 'Database bridge not connected — requires Supabase/Postgres connection with AME credentials',
      retrievedAt: new Date().toISOString(),
      // The bridge interface is ready — when Supabase/Postgres credentials
      // are available in the execution environment, this will fetch real rows
      // from post_performance_insights and return normalized data.
    };
  },

  /**
   * Fetch batch of historical performance data from post_performance_insights
   * @param {Object} options - Fetch options
   * @param {number} options.limit - Maximum number of records (default: 10)
   * @param {string} options.platform - Filter by platform (optional)
   * @param {string} options.startDate - Start date filter (optional, ISO)
   * @param {string} options.endDate - End date filter (optional, ISO)
   * @returns {Object} { status, data[], error, retrievedAt }
   */
  fetchHistoricalPerformance: function(options = {}) {
    const { limit = 10, platform, startDate, endDate } = options;

    // SQL for batch historical fetch
    let sql = `
      SELECT platform_post_id, platform, published_at, reach, impressions, likes, comments, shares, saves,
             facebook_clicks, total_interactions, collection_status, collected_at, api_version
      FROM post_performance_insights
    `;
    const params = [];
    const conditions = [];

    if (platform) {
      conditions.push(`platform = $${params.length + 1}`);
      params.push(platform);
    }

    if (startDate) {
      conditions.push(`collected_at >= $${params.length + 1}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`collected_at <= $${params.length + 1}`);
      params.push(endDate);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY collected_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    // Return interface — actual execution connects to AME's Supabase/Postgres
    // using server-side credentials only (never exposed to Node/GitHub/chats)
    return {
      status: 'UNAVAILABLE',
      data: [],
      error: 'Database bridge not connected — requires Supabase/Postgres connection with AME credentials',
      retrievedAt: new Date().toISOString(),
      // Bridge interface ready — when connected, returns array of normalized
      // performance records from post_performance_insights with status LIVE/UNAVAILABLE/ERROR
    };
  },

  /**
   * Normalize a single post_performance_insights row into the Growth Engine schema
   * @param {Object} row - Raw database row from post_performance_insights
   * @returns {Object} Normalized performance metrics
   */
  normalizeRow: function(row) {
    if (!row) {
      return {
        post_id: null,
        platform: null,
        media_type: null,
        published_at: null,
        reach: null,
        impressions: null,
        likes: null,
        comments: null,
        shares: null,
        saves: null,
        views: null,
        profile_visits: null,
        follows: null,
        watch_time: null,
        engagement_rate: null,
        share_rate: null,
        save_rate: null,
        comment_rate: null,
        profile_action_rate: null,
        source: 'post_performance_insights',
        status: 'UNAVAILABLE',
        retrievedAt: new Date().toISOString(),
      };
    }

    // Map database columns to Growth Engine normalized schema
    const normalized = {
      // Post identification
      post_id: row.platform_post_id || null,
      platform: row.platform || null,
      media_type: this.determineMediaType(row.platform || ''),
      published_at: row.published_at || null,

      // Reach & visibility
      reach: row.reach !== null && row.reach !== undefined ? row.reach : null,
      impressions: row.impressions !== null && row.impressions !== undefined ? row.impressions : null,
      views: null, // Not stored in post_performance_insights; derive from video_views if needed

      // Engagement
      likes: row.likes !== null && row.likes !== undefined ? row.likes : null,
      comments: row.comments !== null && row.comments !== undefined ? row.comments : null,
      shares: row.shares !== null && row.shares !== undefined ? row.shares : null,
      saves: row.saves !== null && row.saves !== undefined ? row.saves : null,

      // Audience actions
      profile_visits: row.facebook_clicks !== null && row.facebook_clicks !== undefined ? row.facebook_clicks : null,
      follows: null, // Not tracked in current schema; null

      // Video-specific
      watch_time: null, // Not tracked in current schema; null

      // Derived rates (calculate if base metrics available)
      engagement_rate: this.calculateEngagementRate(row),
      share_rate: this.calculateShareRate(row),
      save_rate: this.calculateSaveRate(row),
      comment_rate: this.calculateCommentRate(row),
      profile_action_rate: this.calculateProfileActionRate(row),

      // Metadata
      source: 'post_performance_insights',
      status: row.collection_status === 'SUCCESS' && row.reach !== null ? 'LIVE' : 
              row.collection_status === 'FAILED' ? 'ERROR' : 'UNAVAILABLE',
      retrievedAt: row.collected_at ? row.collected_at.toISOString ? row.collected_at.toISOString() : row.collected_at : new Date().toISOString(),
    };

    return normalized;
  },

  /**
   * Determine media type from platform
   * @param {string} platform - Platform name
   * @returns {string} 'IMAGE', 'REELS', 'VIDEO', or null
   */
  determineMediaType: function(platform) {
    const platformMap = {
      'INSTAGRAM_FEED': 'IMAGE',
      'INSTAGRAM_STORY': 'REELS',
      'INSTAGRAM_REELS': 'REELS',
      'FACEBOOK_PAGE': 'IMAGE',
      'FACEBOOK_VIDEO': 'VIDEO',
    };
    return platformMap[platform] || null;
  },

  /**
   * Calculate engagement rate: (likes + comments) / impressions
   * @param {Object} row - Database row
   * @returns {number|null} Engagement rate or null if cannot calculate
   */
  calculateEngagementRate: function(row) {
    if (row.impressions === null || row.impressions === 0 || row.impressions === undefined) {
      return null;
    }
    const likes = row.likes !== null && row.likes !== undefined ? row.likes : 0;
    const comments = row.comments !== null && row.comments !== undefined ? row.comments : 0;
    return Math.round((likes + comments) / row.impressions * 10000) / 10000; // 4 decimal places
  },

  /**
   * Calculate share rate: shares / impressions
   * @param {Object} row - Database row
   * @returns {number|null} Share rate or null
   */
  calculateShareRate: function(row) {
    if (row.impressions === null || row.impressions === 0 || row.impressions === undefined) {
      return null;
    }
    const shares = row.shares !== null && row.shares !== undefined ? row.shares : 0;
    return Math.round(shares / row.impressions * 10000) / 10000;
  },

  /**
   * Calculate save rate: saves / impressions
   * @param {Object} row - Database row
   * @returns {number|null} Save rate or null
   */
  calculateSaveRate: function(row) {
    if (row.impressions === null || row.impressions === 0 || row.impressions === undefined) {
      return null;
    }
    const saves = row.saves !== null && row.saves !== undefined ? row.saves : 0;
    return Math.round(saves / row.impressions * 10000) / 10000;
  },

  /**
   * Calculate comment rate: comments / impressions
   * @param {Object} row - Database row
   * @returns {number|null} Comment rate or null
   */
  calculateCommentRate: function(row) {
    if (row.impressions === null || row.impressions === 0 || row.impressions === undefined) {
      return null;
    }
    const comments = row.comments !== null && row.comments !== undefined ? row.comments : 0;
    return Math.round(comments / row.impressions * 10000) / 10000;
  },

  /**
   * Calculate profile action rate: facebook_clicks / impressions
   * @param {Object} row - Database row
   * @returns {number|null} Profile action rate or null
   */
  calculateProfileActionRate: function(row) {
    if (row.impressions === null || row.impressions === 0 || row.impressions === undefined) {
      return null;
    }
    const clicks = row.facebook_clicks !== null && row.facebook_clicks !== undefined ? row.facebook_clicks : 0;
    return Math.round(clicks / row.impressions * 10000) / 10000;
  },

  /**
   * Verify read-only enforcement — no publishing endpoints referenced
   * @returns {boolean} True if read-only
   */
  verifyReadOnlyEnforcement: function() {
    const source = this.fetchPostPerformance.toString() +
                   this.fetchHistoricalPerformance.toString() +
                   this.normalizeRow.toString();

    const publishingKeywords = [
      'publish', 'create', 'container', 'media_publish', 'delete',
      'update', 'endpoint', 'graph.facebook.com', 'instagram_basic',
    ];

    const lowerSource = source.toLowerCase();
    const foundPublishing = publishingKeywords.filter(k => lowerSource.includes(k.toLowerCase()));

    if (foundPublishing.length > 0) {
      console.warn(`⚠️  WARNING: Bridge contains publishing-related keywords: ${foundPublishing.join(', ')}`);
      return false;
    }

    console.log('✅ Read-only enforcement verified — no publishing endpoints found');
    return true;
  },
};

// Run verification on module load
MetaPerformanceBridge.verifyReadOnlyEnforcement();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetaPerformanceBridge;
}

// Also export for browser/Global use (Hermes adapter context)
if (typeof window !== 'undefined') {
  window.MetaPerformanceBridge = MetaPerformanceBridge;
}