package dev.agentdiscovery.wellknown;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method as an agent-discoverable capability.
 *
 * <p>The starter collects all methods annotated with {@code @AgentCapability}
 * across all Spring-managed beans and includes them in the
 * {@code /.well-known/agent} manifest. Each capability also gets a
 * detail endpoint at {@code /.well-known/agent/capabilities/{name}}
 * that returns full parameter, example, and rate-limit information.</p>
 *
 * <p>Example usage:</p>
 * <pre>{@code
 * @AgentCapability(
 *     name = "send_email",
 *     description = "Send an email to one or more recipients.",
 *     endpoint = "/api/emails",
 *     method = "POST",
 *     parameters = {
 *         @AgentParameter(name = "to", type = "string", required = true,
 *                         description = "Recipient email", example = "alice@example.com"),
 *         @AgentParameter(name = "subject", type = "string", required = true,
 *                         description = "Subject line", example = "Hello")
 *     },
 *     authScopes = {"email.send"},
 *     requestsPerMinute = 60,
 *     dailyLimit = 1000
 * )
 * @PostMapping("/api/emails")
 * public ResponseEntity<Email> sendEmail(@RequestBody EmailRequest req) { ... }
 * }</pre>
 *
 * @see AgentManifest
 * @see AgentParameter
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Repeatable(AgentCapabilities.class)
public @interface AgentCapability {

    /**
     * Machine-readable capability name in snake_case (e.g., {@code "send_email"}).
     */
    String name();

    /**
     * 1-2 sentence description of what this capability does,
     * written for an LLM to understand.
     */
    String description();

    /**
     * API endpoint path relative to the base URL (e.g., {@code "/api/emails"}).
     */
    String endpoint();

    /**
     * HTTP method: {@code "GET"}, {@code "POST"}, {@code "PUT"},
     * {@code "PATCH"}, or {@code "DELETE"}.
     */
    String method();

    /**
     * Parameter definitions for this capability.
     */
    AgentParameter[] parameters() default {};

    /**
     * OAuth scopes required for this specific capability.
     * Empty array means no specific scopes beyond the service-level auth.
     */
    String[] authScopes() default {};

    /**
     * Maximum requests per minute. {@code -1} means not specified.
     */
    int requestsPerMinute() default -1;

    /**
     * Maximum requests per day. {@code -1} means not specified.
     */
    int dailyLimit() default -1;
}
