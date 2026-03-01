package dev.agentdiscovery.wellknown;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Describes the authentication configuration for an agent-discoverable service.
 *
 * <p>Used within {@link AgentManifest} to declare how agents should authenticate
 * when calling this service's API. Supports three authentication types:</p>
 *
 * <ul>
 *   <li>{@code "none"} — Public API, no authentication required.</li>
 *   <li>{@code "api_key"} — API key authentication via a header.</li>
 *   <li>{@code "oauth2"} — OAuth 2.0 authorization code flow.</li>
 * </ul>
 *
 * <p>Example (API key):</p>
 * <pre>{@code
 * @AgentAuth(
 *     type = "api_key",
 *     header = "Authorization",
 *     prefix = "Bearer",
 *     setupUrl = "https://example.com/api-keys"
 * )
 * }</pre>
 *
 * <p>Example (OAuth 2.0):</p>
 * <pre>{@code
 * @AgentAuth(
 *     type = "oauth2",
 *     authorizationUrl = "https://auth.example.com/authorize",
 *     tokenUrl = "https://auth.example.com/token",
 *     scopes = {"read", "write"}
 * )
 * }</pre>
 *
 * @see AgentManifest
 */
@Target({})
@Retention(RetentionPolicy.RUNTIME)
public @interface AgentAuth {

    /**
     * Authentication type: {@code "none"}, {@code "api_key"}, or {@code "oauth2"}.
     */
    String type() default "none";

    /**
     * Header name for API key authentication (e.g., {@code "Authorization"}).
     * Only relevant when {@link #type()} is {@code "api_key"}.
     */
    String header() default "";

    /**
     * Header value prefix for API key authentication (e.g., {@code "Bearer"}).
     * Only relevant when {@link #type()} is {@code "api_key"}.
     */
    String prefix() default "";

    /**
     * URL where developers can create or manage their API keys.
     * Only relevant when {@link #type()} is {@code "api_key"}.
     */
    String setupUrl() default "";

    /**
     * OAuth 2.0 authorization endpoint URL.
     * Only relevant when {@link #type()} is {@code "oauth2"}.
     */
    String authorizationUrl() default "";

    /**
     * OAuth 2.0 token endpoint URL.
     * Only relevant when {@link #type()} is {@code "oauth2"}.
     */
    String tokenUrl() default "";

    /**
     * OAuth 2.0 scopes required by this service.
     * Only relevant when {@link #type()} is {@code "oauth2"}.
     */
    String[] scopes() default {};
}
