'use strict';

/**
 * agent-well-known-express
 *
 * Express middleware that auto-generates Agent Discovery Protocol endpoints:
 *   GET /.well-known/agent              — the service manifest
 *   GET /.well-known/agent/capabilities/:name — capability detail
 *
 * Spec: https://github.com/user/agent-discovery-protocol/tree/main/spec
 */

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_AUTH_TYPES = ['oauth2', 'api_key', 'none'];
const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Validate the user-supplied config and return an array of warning strings.
 * Does NOT throw — issues are advisory so the server can still start.
 */
function validateConfig(config) {
  const warnings = [];

  if (!config) {
    warnings.push('Config is missing or undefined.');
    return warnings;
  }

  // Top-level required fields
  if (!config.name || typeof config.name !== 'string') {
    warnings.push('Missing or invalid "name" (expected non-empty string).');
  }
  if (!config.description || typeof config.description !== 'string') {
    warnings.push('Missing or invalid "description" (expected non-empty string).');
  }
  if (!config.base_url || typeof config.base_url !== 'string') {
    warnings.push('Missing or invalid "base_url" (expected non-empty string).');
  }

  // Auth
  if (!config.auth || typeof config.auth !== 'object') {
    warnings.push('Missing or invalid "auth" object.');
  } else if (!config.auth.type || !VALID_AUTH_TYPES.includes(config.auth.type)) {
    warnings.push(
      'Invalid "auth.type". Expected one of: ' + VALID_AUTH_TYPES.join(', ') + '.'
    );
  }

  // Capabilities
  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    warnings.push('Missing or empty "capabilities" array.');
  } else {
    config.capabilities.forEach(function (cap, idx) {
      var prefix = 'capabilities[' + idx + ']';

      if (!cap.name || typeof cap.name !== 'string') {
        warnings.push(prefix + ': Missing or invalid "name".');
      }
      if (!cap.description || typeof cap.description !== 'string') {
        warnings.push(prefix + ': Missing or invalid "description".');
      }
      if (!cap.handler || typeof cap.handler !== 'object') {
        warnings.push(prefix + ': Missing or invalid "handler" object.');
      } else {
        if (!cap.handler.endpoint || typeof cap.handler.endpoint !== 'string') {
          warnings.push(prefix + ': Missing "handler.endpoint".');
        }
        if (!cap.handler.method || typeof cap.handler.method !== 'string') {
          warnings.push(prefix + ': Missing "handler.method".');
        } else if (!VALID_METHODS.includes(cap.handler.method.toUpperCase())) {
          warnings.push(
            prefix +
              ': Invalid "handler.method" (' +
              cap.handler.method +
              '). Expected one of: ' +
              VALID_METHODS.join(', ') +
              '.'
          );
        }
      }

      // Parameters
      if (cap.parameters) {
        if (!Array.isArray(cap.parameters)) {
          warnings.push(prefix + ': "parameters" must be an array.');
        } else {
          cap.parameters.forEach(function (param, pIdx) {
            var pPrefix = prefix + '.parameters[' + pIdx + ']';
            if (!param.name || typeof param.name !== 'string') {
              warnings.push(pPrefix + ': Missing or invalid "name".');
            }
            if (!param.type || typeof param.type !== 'string') {
              warnings.push(pPrefix + ': Missing or invalid "type".');
            }
            if (typeof param.required !== 'boolean') {
              warnings.push(pPrefix + ': Missing or invalid "required" (expected boolean).');
            }
            if (!param.description || typeof param.description !== 'string') {
              warnings.push(pPrefix + ': Missing or invalid "description".');
            }
          });
        }
      }
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the auth header representation used in auto-generated request examples.
 */
function buildAuthHeader(auth) {
  if (!auth) return {};
  switch (auth.type) {
    case 'oauth2':
      return { Authorization: 'Bearer {access_token}' };
    case 'api_key': {
      var header = auth.header || 'Authorization';
      var prefix = auth.prefix ? auth.prefix + ' ' : '';
      var obj = {};
      obj[header] = prefix + '{api_key}';
      return obj;
    }
    default:
      return {};
  }
}

/**
 * Auto-generate a request_example from the capability definition when the user
 * has not provided one explicitly.
 */
function generateRequestExample(cap, config) {
  var handler = cap.handler || {};
  var method = (handler.method || 'GET').toUpperCase();
  var baseUrl = (config.base_url || '').replace(/\/+$/, '');
  var url = baseUrl + (handler.endpoint || '');

  var headers = Object.assign(
    {},
    buildAuthHeader(config.auth),
    { 'Content-Type': 'application/json' }
  );

  var example = {
    method: method,
    url: url,
    headers: headers,
  };

  // Build body from parameters using their example values
  if (['POST', 'PUT', 'PATCH'].includes(method) && Array.isArray(cap.parameters)) {
    var body = {};
    cap.parameters.forEach(function (param) {
      if (param.required && param.example !== undefined) {
        body[param.name] = param.example;
      }
    });
    if (Object.keys(body).length > 0) {
      example.body = body;
    }
  }

  return example;
}

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

/**
 * Build the spec-v1.0 manifest JSON from the user config.
 */
function buildManifest(config) {
  var manifest = {
    spec_version: '1.0',
    name: config.name,
    description: config.description,
    base_url: config.base_url,
    auth: config.auth,
  };

  if (config.pricing) {
    manifest.pricing = config.pricing;
  }

  manifest.capabilities = (config.capabilities || []).map(function (cap) {
    var name = cap.name || '';
    var entry = {
      name: name,
      description: cap.description || '',
      detail_url: '/.well-known/agent/capabilities/' + name,
    };
    if (cap.resource_group) {
      entry.resource_group = cap.resource_group;
    }
    return entry;
  });

  return manifest;
}

/**
 * Build the capability detail JSON for a single capability.
 */
function buildCapabilityDetail(cap, config) {
  var handler = cap.handler || {};
  var detail = {
    name: cap.name || '',
    description: cap.description || '',
    endpoint: handler.endpoint || '',
    method: (handler.method || 'GET').toUpperCase(),
    parameters: (cap.parameters || []).map(function (p) {
      var param = {
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required,
      };
      if (p.example !== undefined) {
        param.example = p.example;
      }
      return param;
    }),
    request_example: cap.request_example || generateRequestExample(cap, config),
  };

  if (cap.response_example) {
    detail.response_example = cap.response_example;
  }

  if (cap.auth_scopes) {
    detail.auth_scopes = cap.auth_scopes;
  }

  if (cap.rate_limits) {
    detail.rate_limits = cap.rate_limits;
  }

  if (cap.resource_group) {
    detail.resource_group = cap.resource_group;
  }

  return detail;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Create and return an Express Router that serves the Agent Discovery Protocol
 * endpoints for the given service configuration.
 *
 * @param {object} config — service configuration (see README for full reference)
 * @returns {import('express').Router}
 */
function agentManifest(config) {
  // We require express at call-time so it's resolved from the host app's
  // node_modules (peer dependency).
  var express;
  try {
    express = require('express');
  } catch (_err) {
    throw new Error(
      'agent-well-known-express: "express" is a peer dependency and must be installed in your project.'
    );
  }

  // --- Validate --------------------------------------------------------
  var warnings = validateConfig(config);
  if (warnings.length > 0) {
    warnings.forEach(function (w) {
      console.warn('[agent-well-known-express] ' + w);
    });
  }

  // --- Pre-compute manifest & detail map --------------------------------
  var manifest = buildManifest(config);
  var manifestJSON = JSON.stringify(manifest);

  var capabilityDetails = {};
  (config.capabilities || []).forEach(function (cap) {
    capabilityDetails[cap.name] = buildCapabilityDetail(cap, config);
  });

  // --- Router -----------------------------------------------------------
  var router = express.Router();

  // CORS preflight for /.well-known/agent paths
  router.options('/.well-known/agent', function (_req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
  });

  router.options('/.well-known/agent/capabilities/:name', function (_req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
  });

  // GET /.well-known/agent — the manifest
  router.get('/.well-known/agent', function (_req, res) {
    res.set('Content-Type', 'application/json');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).send(manifestJSON);
  });

  // GET /.well-known/agent/capabilities/:name — capability detail
  router.get('/.well-known/agent/capabilities/:name', function (req, res) {
    var name = req.params.name;
    var detail = capabilityDetails[name];

    if (!detail) {
      res.set('Content-Type', 'application/json');
      res.set('Access-Control-Allow-Origin', '*');
      res.status(404).json({
        error: 'Capability not found: ' + name,
      });
      return;
    }

    res.set('Content-Type', 'application/json');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).json(detail);
  });

  return router;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { agentManifest };
