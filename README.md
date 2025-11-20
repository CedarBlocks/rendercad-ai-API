# RenderCAD AI - Node.js Client

A Node.js client library for the RenderCAD AI API. Transform flat images into photorealistic renders via a simple API.

## Installation

```bash
npm install rendercad-ai
```

For Node.js versions below 18, you'll need to install `node-fetch`:

```bash
npm install rendercad-ai node-fetch
```

## Quick Start

```javascript
const RenderCADClient = require('rendercad-ai');

// Initialize client with your API token
const client = new RenderCADClient('YOUR_API_TOKEN');

// Render an image
const result = await client.renderImage('./image.jpg');
console.log('Job ID:', result.job_id);

// Check status
const status = await client.checkStatus(result.job_id);
console.log('Status:', status.status);
if (status.status === 'completed') {
  console.log('Output URL:', status.output_url);
}
```

## Authentication

### Method 1: API Token (Recommended)

Get your API token from: Account Settings → API Tokens → Generate New Token

```javascript
const client = new RenderCADClient('YOUR_API_TOKEN');
```

### Method 2: Device Code Flow

For desktop apps, browser extensions, and CLI tools:

```javascript
const client = new RenderCADClient();

// Step 1: Request device code
const deviceCode = await client.requestDeviceCode({
  app_name: 'My Desktop App',
  app_type: 'desktop-app',
  app_version: '1.0.0'
});

console.log('Code:', deviceCode.code);
console.log('Visit:', deviceCode.verification_url);

// Step 2: Poll for authorization
const checkAuth = async () => {
  const result = await client.pollDeviceCode(deviceCode.code);
  
  if (result.status === 'authorized') {
    client.setApiToken(result.api_token);
    console.log('Authorized!');
  } else {
    // Wait and poll again
    setTimeout(checkAuth, deviceCode.poll_interval * 1000);
  }
};

checkAuth();
```

## API Reference

### Constructor

```javascript
new RenderCADClient(apiToken, options)
```

- `apiToken` (string, optional): Your API token
- `options` (object, optional):
  - `baseUrl` (string): Base URL for the API (default: `'https://rendercad.ai'`)

### Methods

#### `renderImage(image)`

Submit an image for rendering.

**Parameters:**
- `image` (Buffer | string): Image buffer, file path, or base64 data URL

**Returns:** Promise resolving to `{ success: true, job_id: string }`

**Example:**
```javascript
// Using file path
const result = await client.renderImage('./image.jpg');

// Using Buffer
const fs = require('fs');
const buffer = fs.readFileSync('image.jpg');
const result = await client.renderImage(buffer);

// Using base64 string
const result = await client.renderImage('data:image/jpeg;base64,/9j/4AAQ...');
```

#### `checkStatus(jobId)`

Check the status of a render job.

**Parameters:**
- `jobId` (string): Job ID from `renderImage` response

**Returns:** Promise resolving to:
```javascript
{
  success: true,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  output_url?: string  // Present when status is 'completed'
}
```

**Example:**
```javascript
const status = await client.checkStatus('render_68f59c4d873762.99760761');
```

#### `checkAccount()`

Get account information and usage statistics.

**Returns:** Promise resolving to:
```javascript
{
  success: true,
  user: {
    monthly_render_limit: number,
    monthly_renders_used: number
  }
}
```

**Example:**
```javascript
const account = await client.checkAccount();
console.log(`Used ${account.user.monthly_renders_used} of ${account.user.monthly_render_limit} renders`);
```

#### `requestDeviceCode(options)`

Request a device code for OAuth-style authentication.

**Parameters:**
- `options` (object, optional):
  - `app_name` (string): Application name
  - `app_type` (string): `'browser-extension'`, `'desktop-app'`, `'mobile-app'`, or `'cli-tool'`
  - `app_version` (string): Application version

**Returns:** Promise resolving to:
```javascript
{
  success: true,
  code: string,
  expires_in: number,
  poll_interval: number,
  verification_url: string
}
```

#### `pollDeviceCode(code)`

Poll for device code authorization.

**Parameters:**
- `code` (string): Device code from `requestDeviceCode`

**Returns:** Promise resolving to:
```javascript
{
  status: 'pending' | 'authorized',
  api_token?: string  // Present when status is 'authorized'
}
```

#### `setApiToken(token)`

Set or update the API token.

**Parameters:**
- `token` (string): API token

## Error Handling

The client throws custom error classes for different HTTP status codes:

```javascript
const {
  RenderCADError,
  BadRequestError,      // 400
  UnauthorizedError,   // 401
  NotFoundError,       // 404
  RateLimitError,      // 429
  ServerError,         // 500
} = require('rendercad-ai/src/errors');

try {
  await client.renderImage('./image.jpg');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Monthly limit exceeded');
  } else if (error instanceof UnauthorizedError) {
    console.log('Invalid API token');
  } else {
    console.log('Error:', error.message);
  }
}
```

## Complete Example

```javascript
const RenderCADClient = require('rendercad-ai');
const fs = require('fs');

async function renderExample() {
  const client = new RenderCADClient('YOUR_API_TOKEN');

  try {
    // Check account
    const account = await client.checkAccount();
    console.log(`Account: ${account.user.monthly_renders_used}/${account.user.monthly_render_limit} renders used`);

    // Render image
    const result = await client.renderImage('./input.jpg');
    console.log('Job ID:', result.job_id);

    // Poll for completion
    let status;
    do {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      status = await client.checkStatus(result.job_id);
      console.log('Status:', status.status);
    } while (status.status === 'pending' || status.status === 'processing');

    if (status.status === 'completed') {
      console.log('Render complete! Output URL:', status.output_url);
    } else {
      console.log('Render failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

renderExample();
```

## Image Requirements

- **Formats:** JPEG, PNG, GIF, WebP
- **Max size:** 10MB
- **Encoding:** Automatically handled by the client (base64 with data URL prefix)

## Rate Limits

- Monthly token limits based on your plan
- Each render consumes 1 token
- API blocked when token limit exceeded
- Usage resets monthly

## License

MIT

