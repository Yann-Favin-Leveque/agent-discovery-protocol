package dev.agentdiscovery.wellknown;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Defines a parameter for an {@link AgentCapability}.
 *
 * <p>Each parameter describes one input the API endpoint accepts,
 * including its name, type, whether it is required, a human-readable
 * description, and an optional example value.</p>
 *
 * <p>Example usage:</p>
 * <pre>{@code
 * @AgentParameter(
 *     name = "to",
 *     type = "string",
 *     required = true,
 *     description = "Recipient email address",
 *     example = "alice@example.com"
 * )
 * }</pre>
 *
 * @see AgentCapability
 */
@Target({})
@Retention(RetentionPolicy.RUNTIME)
public @interface AgentParameter {

    /**
     * Parameter name as it appears in the API request body or query string.
     */
    String name();

    /**
     * Parameter type. One of: {@code "string"}, {@code "number"},
     * {@code "boolean"}, {@code "object"}, {@code "string[]"}, {@code "object[]"}.
     */
    String type();

    /**
     * Whether this parameter is required for the API call.
     */
    boolean required();

    /**
     * Human-readable description of what this parameter does.
     * Written for an LLM to understand.
     */
    String description();

    /**
     * Example value for this parameter, serialized as a string.
     * Defaults to empty string (no example).
     */
    String example() default "";
}
