import type { ApiNode, ResponseExample } from '../models/portal.model'

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function jsonResponse(
  id: string,
  statusCode: string,
  description: string,
  schema: unknown,
  example: unknown,
): ResponseExample {
  return {
    id,
    statusCode,
    description,
    content: [
      {
        id: `${id}-json`,
        mediaType: 'application/json',
        schema: json(schema),
        example: json(example),
      },
    ],
  }
}

const userSchema = {
  type: 'object',
  required: ['id', 'name', 'email', 'role', 'createdAt'],
  properties: {
    id: { type: 'string', example: 'usr_01J8M8K2' },
    name: { type: 'string', example: 'Alex Morgan' },
    email: { type: 'string', format: 'email', example: 'alex@example.test' },
    role: { type: 'string', enum: ['admin', 'member'], example: 'member' },
    createdAt: { type: 'string', format: 'date-time' },
  },
}

const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'array', items: { type: 'object' } },
      },
    },
  },
}

const listUsers: ApiNode = {
  id: 'sample-list-users',
  name: 'List users',
  kind: 'request',
  method: 'GET',
  url: 'https://api.example.test/v1/users',
  documentation: 'Returns users visible to the current workspace. Results are ordered by creation date, newest first. Use the cursor from the previous response to fetch the next page.',
  auth: { type: 'bearer', token: 'demo-access-token' },
  bodyMode: 'none',
  params: [
    { id: 'list-users-page', name: 'page', value: '1', enabled: true, description: 'Page number for numbered pagination.' },
    { id: 'list-users-per-page', name: 'perPage', value: '20', enabled: true, description: 'Number of records to return. Maximum: 100.' },
    { id: 'list-users-role', name: 'role', value: 'member', enabled: true, description: 'Filter by workspace role.' },
    { id: 'list-users-include-inactive', name: 'includeInactive', value: 'false', enabled: false, description: 'Include deactivated accounts.' },
  ],
  headers: [
    { id: 'list-users-accept', name: 'Accept', value: 'application/json', enabled: true, description: 'Expected response format.' },
    { id: 'list-users-authorization', name: 'Authorization', value: 'Bearer demo-access-token', enabled: true, description: 'Workspace access token.' },
  ],
  responses: [
    jsonResponse('list-users-200', '200 OK', 'The requested page of users.', {
      type: 'object',
      properties: {
        data: { type: 'array', items: userSchema },
        meta: { type: 'object', properties: { page: { type: 'integer' }, perPage: { type: 'integer' }, total: { type: 'integer' } } },
      },
    }, {
      data: [
        { id: 'usr_01J8M8K2', name: 'Alex Morgan', email: 'alex@example.test', role: 'member', createdAt: '2026-11-18T09:30:00Z' },
        { id: 'usr_01J8M9P4', name: 'Sam Rivera', email: 'sam@example.test', role: 'member', createdAt: '2026-11-17T15:12:00Z' },
      ],
      meta: { page: 1, perPage: 20, total: 42 },
    }),
    jsonResponse('list-users-401', '401 Unauthorized', 'The access token is missing or expired.', errorSchema, {
      error: { code: 'UNAUTHENTICATED', message: 'A valid access token is required.' },
    }),
  ],
}

const createUser: ApiNode = {
  id: 'sample-create-user',
  name: 'Create user',
  kind: 'request',
  method: 'POST',
  url: 'https://api.example.test/v1/users',
  documentation: 'Creates a workspace user and sends an invitation to the supplied email address. Email addresses must be unique within the workspace. The invitation expires after 7 days.',
  auth: { type: 'bearer', token: 'demo-access-token' },
  bodyMode: 'json',
  bodyMimeType: 'application/json',
  headers: [
    { id: 'create-user-content-type', name: 'Content-Type', value: 'application/json', enabled: true, description: 'Request body format.' },
    { id: 'create-user-accept', name: 'Accept', value: 'application/json', enabled: true, description: 'Expected response format.' },
    { id: 'create-user-authorization', name: 'Authorization', value: 'Bearer demo-access-token', enabled: true, description: 'Workspace access token.' },
  ],
  body: json({ name: 'Alex Morgan', email: 'alex@example.test', role: 'member' }),
  responses: [
    jsonResponse('create-user-201', '201 Created', 'The user was created and an invitation was queued.', {
      type: 'object',
      properties: { data: userSchema },
    }, {
      data: { id: 'usr_01J8M8K2', name: 'Alex Morgan', email: 'alex@example.test', role: 'member', createdAt: '2026-11-24T09:30:00Z' },
    }),
    jsonResponse('create-user-422', '422 Unprocessable Entity', 'One or more fields failed validation.', errorSchema, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Please review the submitted fields.',
        details: [{ field: 'email', code: 'already_exists', message: 'This email is already in the workspace.' }],
      },
    }),
    jsonResponse('create-user-401', '401 Unauthorized', 'The access token is missing or expired.', errorSchema, {
      error: { code: 'UNAUTHENTICATED', message: 'A valid access token is required.' },
    }),
  ],
}

const getUser: ApiNode = {
  id: 'sample-get-user',
  name: 'Get user',
  kind: 'request',
  method: 'GET',
  url: 'https://api.example.test/v1/users/{userId}',
  documentation: 'Returns the user that matches the supplied userId. The user must belong to the current workspace.',
  auth: { type: 'bearer', token: 'demo-access-token' },
  bodyMode: 'none',
  pathParams: [
    { id: 'get-user-id', name: 'userId', value: 'usr_01J8M8K2', enabled: true, description: 'Unique identifier of the user.' },
  ],
  headers: [
    { id: 'get-user-accept', name: 'Accept', value: 'application/json', enabled: true, description: 'Expected response format.' },
    { id: 'get-user-authorization', name: 'Authorization', value: 'Bearer demo-access-token', enabled: true, description: 'Workspace access token.' },
  ],
  responses: [
    jsonResponse('get-user-200', '200 OK', 'The user was found.', { type: 'object', properties: { data: userSchema } }, {
      data: { id: 'usr_01J8M8K2', name: 'Alex Morgan', email: 'alex@example.test', role: 'member', createdAt: '2026-11-18T09:30:00Z' },
    }),
    jsonResponse('get-user-404', '404 Not Found', 'No user with this identifier exists in the workspace.', errorSchema, {
      error: { code: 'USER_NOT_FOUND', message: 'The requested user could not be found.' },
    }),
  ],
}

const uploadUserAvatar: ApiNode = {
  id: 'sample-upload-user-avatar',
  name: 'Upload user avatar',
  kind: 'request',
  method: 'POST',
  url: 'https://api.example.test/v1/users/{userId}/avatar',
  documentation: 'Uploads or replaces a user avatar. The file must be a PNG, JPEG, or WebP image smaller than 5 MB. The multipart boundary is generated by the HTTP client.',
  auth: { type: 'bearer', token: 'demo-access-token' },
  bodyMode: 'form-data',
  bodyMimeType: 'multipart/form-data',
  pathParams: [
    { id: 'upload-avatar-user-id', name: 'userId', value: 'usr_01J8M8K2', enabled: true, description: 'Unique identifier of the user.' },
  ],
  headers: [
    { id: 'upload-avatar-authorization', name: 'Authorization', value: 'Bearer demo-access-token', enabled: true, description: 'Workspace access token.' },
  ],
  bodyFields: [
    { id: 'upload-avatar-file', name: 'avatar', value: '', enabled: true, type: 'file', fileName: 'profile-photo.webp' },
    { id: 'upload-avatar-alt-text', name: 'altText', value: 'Alex smiling outdoors', enabled: true, type: 'text' },
    { id: 'upload-avatar-source', name: 'source', value: 'profile-settings', enabled: false, type: 'text' },
  ],
  responses: [
    jsonResponse('upload-avatar-200', '200 OK', 'The avatar was uploaded and attached to the user.', {
      type: 'object',
      properties: { data: { type: 'object', properties: { userId: { type: 'string' }, avatarUrl: { type: 'string', format: 'uri' }, updatedAt: { type: 'string', format: 'date-time' } } } },
    }, { data: { userId: 'usr_01J8M8K2', avatarUrl: 'https://cdn.example.test/avatars/usr_01J8M8K2.webp', updatedAt: '2026-11-24T11:20:00Z' } }),
    jsonResponse('upload-avatar-413', '413 Payload Too Large', 'The uploaded file exceeds the 5 MB limit.', errorSchema, {
      error: { code: 'FILE_TOO_LARGE', message: 'Avatar files must be smaller than 5 MB.' },
    }),
  ],
}

const login: ApiNode = {
  id: 'sample-login',
  name: 'Log in',
  kind: 'request',
  method: 'POST',
  url: 'https://api.example.test/v1/auth/login',
  documentation: 'Authenticates a user with email and password. The returned access token is short-lived; use the refresh endpoint to renew the session.',
  auth: { type: 'none' },
  bodyMode: 'json',
  bodyMimeType: 'application/json',
  headers: [
    { id: 'login-content-type', name: 'Content-Type', value: 'application/json', enabled: true, description: 'Request body format.' },
    { id: 'login-accept', name: 'Accept', value: 'application/json', enabled: true, description: 'Expected response format.' },
  ],
  body: json({ email: 'alex@example.test', password: 'sample-password' }),
  responses: [
    jsonResponse('login-200', '200 OK', 'Credentials were accepted and a session was created.', {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'integer', description: 'Access token lifetime in seconds.' },
        user: userSchema,
      },
    }, {
      accessToken: 'sample-access-token',
      refreshToken: 'sample-refresh-token',
      expiresIn: 900,
      user: { id: 'usr_01J8M8K2', name: 'Alex Morgan', email: 'alex@example.test', role: 'member', createdAt: '2026-11-18T09:30:00Z' },
    }),
    jsonResponse('login-401', '401 Unauthorized', 'The email or password is incorrect.', errorSchema, {
      error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
    }),
  ],
}

const refreshSession: ApiNode = {
  id: 'sample-refresh-session',
  name: 'Refresh session',
  kind: 'request',
  method: 'POST',
  url: 'https://api.example.test/v1/auth/refresh',
  documentation: 'Exchanges a valid refresh token for a new access token and refresh token. Refresh tokens are rotated after each successful exchange.',
  auth: { type: 'none' },
  bodyMode: 'json',
  bodyMimeType: 'application/json',
  headers: [
    { id: 'refresh-content-type', name: 'Content-Type', value: 'application/json', enabled: true, description: 'Request body format.' },
  ],
  body: json({ refreshToken: 'sample-refresh-token' }),
  responses: [
    jsonResponse('refresh-200', '200 OK', 'A new token pair was issued.', {
      type: 'object',
      required: ['accessToken', 'refreshToken', 'expiresIn'],
      properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'integer' } },
    }, { accessToken: 'sample-access-token', refreshToken: 'sample-refresh-token', expiresIn: 900 }),
    jsonResponse('refresh-401', '401 Unauthorized', 'The refresh token is invalid, expired, or already rotated.', errorSchema, {
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Sign in again to start a new session.' },
    }),
  ],
}

const listPayments: ApiNode = {
  id: 'sample-list-payments',
  name: 'List payments',
  kind: 'request',
  method: 'GET',
  url: 'https://api.example.test/v1/payments',
  documentation: 'Returns payments for the current workspace. Use status and createdAfter to narrow the results; the cursor is returned in the response metadata.',
  auth: { type: 'bearer', token: 'demo-access-token' },
  bodyMode: 'none',
  params: [
    { id: 'payments-status', name: 'status', value: 'succeeded', enabled: true, description: 'Filter by payment status.' },
    { id: 'payments-created-after', name: 'createdAfter', value: '2026-11-01T00:00:00Z', enabled: true, description: 'Return payments created after this ISO 8601 timestamp.' },
    { id: 'payments-limit', name: 'limit', value: '25', enabled: true, description: 'Maximum number of results, from 1 to 100.' },
  ],
  headers: [
    { id: 'payments-accept', name: 'Accept', value: 'application/json', enabled: true, description: 'Expected response format.' },
    { id: 'payments-authorization', name: 'Authorization', value: 'Bearer demo-access-token', enabled: true, description: 'Workspace access token.' },
  ],
  responses: [
    jsonResponse('payments-200', '200 OK', 'A page of matching payments.', {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'integer' }, currency: { type: 'string' }, status: { type: 'string' } } } },
        meta: { type: 'object', properties: { nextCursor: { type: ['string', 'null'] } } },
      },
    }, {
      data: [
        { id: 'pay_01J9A2R7', amount: 250000, currency: 'IDR', status: 'succeeded' },
        { id: 'pay_01J9A3K1', amount: 125000, currency: 'IDR', status: 'succeeded' },
      ],
      meta: { nextCursor: 'cur_sample_02' },
    }),
  ],
}

const createPayment: ApiNode = {
  id: 'sample-create-payment',
  name: 'Create payment',
  kind: 'request',
  method: 'POST',
  url: 'https://api.example.test/v1/payments',
  documentation: 'Creates a payment intent in the specified currency. Send a unique Idempotency-Key to safely retry this request without creating duplicate payments.',
  auth: { type: 'bearer', token: 'demo-access-token' },
  bodyMode: 'json',
  bodyMimeType: 'application/json',
  headers: [
    { id: 'create-payment-content-type', name: 'Content-Type', value: 'application/json', enabled: true, description: 'Request body format.' },
    { id: 'create-payment-idempotency', name: 'Idempotency-Key', value: 'order_123_attempt_1', enabled: true, description: 'Unique key for a single logical payment attempt.' },
    { id: 'create-payment-authorization', name: 'Authorization', value: 'Bearer demo-access-token', enabled: true, description: 'Workspace access token.' },
  ],
  body: json({ amount: 250000, currency: 'IDR', description: 'Annual subscription', customerId: 'cus_01J9A1V8' }),
  responses: [
    jsonResponse('create-payment-201', '201 Created', 'The payment intent was created.', {
      type: 'object',
      properties: { data: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'integer' }, currency: { type: 'string' }, status: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } } },
    }, {
      data: { id: 'pay_01J9A2R7', amount: 250000, currency: 'IDR', status: 'requires_confirmation', createdAt: '2026-11-24T10:45:00Z' },
    }),
    jsonResponse('create-payment-409', '409 Conflict', 'The idempotency key was already used with a different request.', errorSchema, {
      error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Use a new Idempotency-Key for a different payment.' },
    }),
    jsonResponse('create-payment-422', '422 Unprocessable Entity', 'The amount, currency, or customer is invalid.', errorSchema, {
      error: { code: 'VALIDATION_FAILED', message: 'The submitted payment details are invalid.' },
    }),
  ],
}

export const collectionsPreviewTree: ApiNode[] = [
  {
    id: 'sample-users-folder',
    name: 'Users',
    kind: 'folder',
    children: [listUsers, createUser, getUser, uploadUserAvatar],
  },
  {
    id: 'sample-auth-folder',
    name: 'Authentication',
    kind: 'folder',
    children: [login, refreshSession],
  },
  {
    id: 'sample-payments-folder',
    name: 'Payments',
    kind: 'folder',
    children: [listPayments, createPayment],
  },
]

export const collectionsPreviewDefaultRequest = createUser
