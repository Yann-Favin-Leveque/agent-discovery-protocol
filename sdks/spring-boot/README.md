# Agent Discovery Protocol - Spring Boot Starter

A Spring Boot starter that auto-exposes a `/.well-known/agent` endpoint following the [Agent Discovery Protocol](../../spec/README.md) specification v1.0. Annotate your application class and controller methods to make your API discoverable by AI agents at runtime — no configuration files, no plugins, no installation per service.

## Installation

### Maven

```xml
<dependency>
    <groupId>dev.agentdiscovery</groupId>
    <artifactId>agent-well-known-spring-boot</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'dev.agentdiscovery:agent-well-known-spring-boot:1.0.0'
```

## Quick Start

### 1. Annotate your application class

```java
@AgentManifest(
    name = "My API",
    description = "What my API does in 2-3 sentences. Write it for an AI agent to understand.",
    baseUrl = "https://api.example.com",
    auth = @AgentAuth(
        type = "api_key",
        header = "Authorization",
        prefix = "Bearer",
        setupUrl = "https://example.com/api-keys"
    )
)
@SpringBootApplication
public class MyApp {
    public static void main(String[] args) {
        SpringApplication.run(MyApp.class, args);
    }
}
```

### 2. Annotate your controller methods

```java
@RestController
public class EmailController {

    @AgentCapability(
        name = "send_email",
        description = "Send an email to one or more recipients with subject and body.",
        endpoint = "/api/emails",
        method = "POST",
        parameters = {
            @AgentParameter(name = "to", type = "string", required = true,
                            description = "Recipient email address", example = "alice@example.com"),
            @AgentParameter(name = "subject", type = "string", required = true,
                            description = "Email subject line", example = "Hello"),
            @AgentParameter(name = "body", type = "string", required = true,
                            description = "Email body content", example = "Hi there")
        },
        authScopes = {"email.send"},
        requestsPerMinute = 60,
        dailyLimit = 1000
    )
    @PostMapping("/api/emails")
    public ResponseEntity<Email> sendEmail(@RequestBody EmailRequest req) {
        // your logic here
    }
}
```

### 3. Done

Start your application. Two endpoints are now available:

- `GET /.well-known/agent` -- returns the manifest with your service metadata and capability summaries
- `GET /.well-known/agent/capabilities/{name}` -- returns full detail for a specific capability

```bash
curl http://localhost:8080/.well-known/agent
```

```json
{
  "spec_version": "1.0",
  "name": "My API",
  "description": "What my API does in 2-3 sentences.",
  "base_url": "https://api.example.com",
  "auth": {
    "type": "api_key",
    "header": "Authorization",
    "prefix": "Bearer",
    "setup_url": "https://example.com/api-keys"
  },
  "capabilities": [
    {
      "name": "send_email",
      "description": "Send an email to one or more recipients with subject and body.",
      "detail_url": "/.well-known/agent/capabilities/send_email"
    }
  ]
}
```

```bash
curl http://localhost:8080/.well-known/agent/capabilities/send_email
```

```json
{
  "name": "send_email",
  "description": "Send an email to one or more recipients with subject and body.",
  "endpoint": "/api/emails",
  "method": "POST",
  "parameters": [
    { "name": "to", "type": "string", "description": "Recipient email address", "required": true, "example": "alice@example.com" },
    { "name": "subject", "type": "string", "description": "Email subject line", "required": true, "example": "Hello" },
    { "name": "body", "type": "string", "description": "Email body content", "required": true, "example": "Hi there" }
  ],
  "request_example": {
    "method": "POST",
    "url": "https://api.example.com/api/emails",
    "headers": {
      "Authorization": "Bearer {api_key}",
      "Content-Type": "application/json"
    },
    "body": {
      "to": "alice@example.com",
      "subject": "Hello",
      "body": "Hi there"
    }
  },
  "response_example": {
    "status": 200,
    "body": { "success": true, "data": {} }
  },
  "auth_scopes": ["email.send"],
  "rate_limits": {
    "requests_per_minute": 60,
    "daily_limit": 1000
  }
}
```

## Alternative: application.yml Configuration

Instead of annotations, you can configure everything via `application.yml`:

```yaml
agent:
  manifest:
    name: My API
    description: What my API does in 2-3 sentences.
    base-url: https://api.example.com
    auth:
      type: oauth2
      authorization-url: https://auth.example.com/authorize
      token-url: https://auth.example.com/token
      scopes:
        - read
        - write
    capabilities:
      - name: send_email
        description: Send an email to one or more recipients.
        endpoint: /api/emails
        method: POST
        auth-scopes:
          - email.send
        requests-per-minute: 60
        daily-limit: 1000
        parameters:
          - name: to
            type: string
            required: true
            description: Recipient email address
            example: alice@example.com
          - name: subject
            type: string
            required: true
            description: Email subject line
            example: Hello
```

You can also mix both approaches: use `@AgentManifest` for service-level metadata and `application.yml` for capabilities, or vice versa. Annotation-defined capabilities take precedence over property-defined ones with the same name.

## Auth Types

### No authentication (public API)

```java
@AgentManifest(
    name = "Public API",
    description = "A public API that requires no authentication.",
    baseUrl = "https://api.example.com"
    // auth defaults to @AgentAuth(type = "none")
)
```

### API Key

```java
@AgentManifest(
    name = "My API",
    description = "...",
    baseUrl = "https://api.example.com",
    auth = @AgentAuth(
        type = "api_key",
        header = "Authorization",
        prefix = "Bearer",
        setupUrl = "https://example.com/api-keys"
    )
)
```

### OAuth 2.0

```java
@AgentManifest(
    name = "My API",
    description = "...",
    baseUrl = "https://api.example.com",
    auth = @AgentAuth(
        type = "oauth2",
        authorizationUrl = "https://auth.example.com/authorize",
        tokenUrl = "https://auth.example.com/token",
        scopes = {"read", "write"}
    )
)
```

## What Gets Auto-Configured

When this starter is on the classpath and the application is a web application:

1. **Bean scanning** -- All Spring-managed beans are scanned for `@AgentManifest` and `@AgentCapability` annotations at startup.
2. **Properties binding** -- `agent.manifest.*` properties are bound via `@ConfigurationProperties`.
3. **Controller registration** -- An `AgentManifestController` bean is created with two endpoints:
   - `GET /.well-known/agent` (manifest)
   - `GET /.well-known/agent/capabilities/{name}` (capability detail)
4. **CORS headers** -- `Access-Control-Allow-Origin: *` is set on all responses.
5. **Cache-Control** -- `public, max-age=3600` is set on all responses.
6. **Request examples** -- Auto-generated from parameter metadata and auth configuration.
7. **Logging** -- Registration details are logged at startup via SLF4J.

## Requirements

- Java 17+
- Spring Boot 2.7+ or 3.x (both are supported via `spring.factories` and `AutoConfiguration.imports`)

## Spec Compliance

This starter produces output compliant with [Agent Discovery Protocol v1.0](../../spec/README.md):

- Manifest at `/.well-known/agent` with `spec_version`, `name`, `description`, `base_url`, `auth`, and `capabilities`
- Capability detail at `/.well-known/agent/capabilities/{name}` with `endpoint`, `method`, `parameters`, `request_example`, `response_example`, `auth_scopes`, and `rate_limits`
- All JSON fields use `snake_case` per the spec
- Public access (no auth required to read the manifest or capability details)
- CORS enabled for browser-based agents

## Links

- [Agent Discovery Protocol Specification](../../spec/README.md)
- [Agent Discovery Registry](https://registry.agentdiscovery.dev)
- [Gateway MCP](../../gateway-mcp/)

## License

MIT
