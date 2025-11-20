const fs = require('fs').promises;
const path = require('path');
const {
  RenderCADError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  RateLimitError,
  ServerError,
} = require('./errors');

// Use native fetch if available (Node 18+), otherwise use node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    throw new Error(
      'fetch is not available. Please use Node.js 18+ or install node-fetch: npm install node-fetch'
    );
  }
}

/**
 * RenderCAD AI API Client
 * 
 * @class RenderCADClient
 */
class RenderCADClient {
  /**
   * Create a RenderCAD API client
   * 
   * @param {string} apiToken - Your API token (optional if using device code flow)
   * @param {object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for the API (default: 'https://rendercad.ai')
   */
  constructor(apiToken = null, options = {}) {
    this.apiToken = apiToken;
    this.baseUrl = options.baseUrl || 'https://rendercad.ai';
  }

  /**
   * Set the API token
   * 
   * @param {string} token - API token
   */
  setApiToken(token) {
    this.apiToken = token;
  }

  /**
   * Get headers for API requests
   * 
   * @private
   * @returns {object} Headers object
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'User-Agent': 'rendercad-ai-node-client/1.0.0',
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    return headers;
  }

  /**
   * Make an API request
   * 
   * @private
   * @param {string} endpoint - API endpoint
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Response data
   * @throws {RenderCADError} API error
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Only include Content-Type for requests with a body
    const baseHeaders = this._getHeaders();
    if (options.method === 'GET' || !options.body) {
      delete baseHeaders['Content-Type'];
    }
    
    const config = {
      ...options,
      headers: {
        ...baseHeaders,
        ...(options.headers || {}),
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      // Check for API-level errors (success: false in response body)
      if (data.success === false) {
        if (data.token_valid === false || data.authenticated === false) {
          throw new UnauthorizedError(data.message || 'Invalid API token', data);
        }
        const errorMessage = data.message || data.error || 'Request failed';
        throw new BadRequestError(errorMessage, data);
      }

      if (!response.ok) {
        const errorMessage = data.message || data.error || `HTTP ${response.status}`;
        
        switch (response.status) {
          case 400:
            throw new BadRequestError(errorMessage, data);
          case 401:
            throw new UnauthorizedError(errorMessage, data);
          case 404:
            throw new NotFoundError(errorMessage, data);
          case 429:
            throw new RateLimitError(errorMessage, data);
          case 500:
            throw new ServerError(errorMessage, data);
          default:
            throw new RenderCADError(errorMessage, response.status, data);
        }
      }

      return data;
    } catch (error) {
      if (error instanceof RenderCADError) {
        throw error;
      }
      throw new RenderCADError(
        `Request failed: ${error.message}`,
        null,
        null
      );
    }
  }

  /**
   * Encode image to base64 data URL
   * 
   * @private
   * @param {Buffer|string} image - Image buffer, file path, or base64 string
   * @returns {Promise<string>} Base64 data URL
   */
  async _encodeImage(image) {
    // If it's already a data URL, return as is
    if (typeof image === 'string' && image.startsWith('data:image/')) {
      return image;
    }

    // If it's a base64 string without prefix, try to detect format
    if (typeof image === 'string' && !image.includes('/')) {
      // Assume JPEG if no prefix
      return `data:image/jpeg;base64,${image}`;
    }

    let buffer;
    let mimeType = 'image/jpeg';

    // If it's a file path, read it
    if (typeof image === 'string') {
      const filePath = image;
      buffer = await fs.readFile(filePath);
      
      // Detect MIME type from extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      mimeType = mimeTypes[ext] || 'image/jpeg';
    } else if (Buffer.isBuffer(image)) {
      buffer = image;
      // Try to detect MIME type from buffer header
      if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        mimeType = 'image/png';
      } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
        mimeType = 'image/gif';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        mimeType = 'image/webp';
      }
    } else {
      throw new BadRequestError('Invalid image format. Expected Buffer, file path, or base64 string.');
    }

    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Submit an image for rendering
   * 
   * @param {Buffer|string} image - Image buffer, file path, or base64 string
   * @returns {Promise<object>} Response with job_id
   * @throws {RenderCADError} API error
   * 
   * @example
   * // Using file path
   * const result = await client.renderImage('./image.jpg');
   * 
   * @example
   * // Using Buffer
   * const fs = require('fs');
   * const buffer = fs.readFileSync('image.jpg');
   * const result = await client.renderImage(buffer);
   * 
   * @example
   * // Using base64 string
   * const result = await client.renderImage('data:image/jpeg;base64,/9j/4AAQ...');
   */
  async renderImage(image) {
    if (!this.apiToken) {
      throw new UnauthorizedError('API token is required. Set it in constructor or use setApiToken().');
    }

    const imageData = await this._encodeImage(image);
    
    return this._request('/backend/render.php?action=render', {
      method: 'POST',
      body: JSON.stringify({ image: imageData }),
    });
  }

  /**
   * Check the status of a render job
   * 
   * @param {string} jobId - Job ID from renderImage response
   * @returns {Promise<object>} Response with status and output_url (if completed)
   * @throws {RenderCADError} API error
   * 
   * @example
   * const status = await client.checkStatus('render_68f59c4d873762.99760761');
   * console.log(status.status); // 'pending', 'processing', 'completed', or 'failed'
   */
  async checkStatus(jobId) {
    if (!this.apiToken) {
      throw new UnauthorizedError('API token is required. Set it in constructor or use setApiToken().');
    }

    if (!jobId) {
      throw new BadRequestError('jobId is required');
    }

    return this._request(`/backend/render.php?action=status&job_id=${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });
  }

  /**
   * Check account information and usage
   * 
   * @returns {Promise<object>} Response with user account information
   * @throws {RenderCADError} API error
   * 
   * @example
   * const account = await client.checkAccount();
   * console.log(account.user.monthly_render_limit);
   * console.log(account.user.monthly_renders_used);
   */
  async checkAccount() {
    if (!this.apiToken) {
      throw new UnauthorizedError('API token is required. Set it in constructor or use setApiToken().');
    }

    return this._request('/backend/auth.php?action=check', {
      method: 'GET',
    });
  }

  /**
   * Request a device code for OAuth-style authentication
   * 
   * @param {object} options - Device code options
   * @param {string} options.app_name - Application name (e.g., "My Desktop App")
   * @param {string} options.app_type - Application type: 'browser-extension', 'desktop-app', 'mobile-app', 'cli-tool'
   * @param {string} options.app_version - Application version (e.g., "1.0.0")
   * @returns {Promise<object>} Response with code, expires_in, poll_interval, and verification_url
   * @throws {RenderCADError} API error
   * 
   * @example
   * const deviceCode = await client.requestDeviceCode({
   *   app_name: 'My App',
   *   app_type: 'desktop-app',
   *   app_version: '1.0.0'
   * });
   * console.log(deviceCode.code); // 'ABC123'
   * console.log(deviceCode.verification_url);
   */
  async requestDeviceCode(options = {}) {
    const params = new URLSearchParams();
    
    if (options.app_name) {
      params.append('app_name', options.app_name);
    }
    if (options.app_type) {
      params.append('app_type', options.app_type);
    }
    if (options.app_version) {
      params.append('app_version', options.app_version);
    }

    const queryString = params.toString();
    const endpoint = `/backend/auth.php?action=request_device_code${queryString ? '&' + queryString : ''}`;

    return this._request(endpoint, {
      method: 'POST',
    });
  }

  /**
   * Poll for device code authorization
   * 
   * @param {string} code - Device code from requestDeviceCode
   * @returns {Promise<object>} Response with status and api_token (if authorized)
   * @throws {RenderCADError} API error
   * 
   * @example
   * const result = await client.pollDeviceCode('ABC123');
   * if (result.status === 'authorized') {
   *   client.setApiToken(result.api_token);
   * }
   */
  async pollDeviceCode(code) {
    if (!code) {
      throw new BadRequestError('Device code is required');
    }

    return this._request(`/backend/auth.php?action=poll_device_code&code=${encodeURIComponent(code)}`, {
      method: 'GET',
    });
  }
}

module.exports = RenderCADClient;
module.exports.default = RenderCADClient;

