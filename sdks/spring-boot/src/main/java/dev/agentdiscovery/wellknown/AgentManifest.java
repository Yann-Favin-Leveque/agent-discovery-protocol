package dev.agentdiscovery.wellknown;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a Spring component (typically the {@code @SpringBootApplication} class)
 * as the source of the Agent Discovery Protocol manifest metadata.
 *
 * <p>When this annotation is present on any Spring-managed bean, the starter
 * auto-configures a {@code /.well-known/agent} endpoint that returns a
 * spec-compliant manifest describing the service and its capabilities.</p>
 *
 * <p>Example usage:</p>
 * <pre>{@code
 * @AgentManifest(
 *     name = "My API",
 *     description = "What my API does in 2-3 sentences.",
 *     baseUrl = "https://api.example.com",
 *     auth = @AgentAuth(type = "api_key", header = "Authorization", prefix = "Bearer",
 *                       setupUrl = "https://example.com/api-keys")
 * )
 * @SpringBootApplication
 * public class MyApp {
 *     public static void main(String[] args) {
 *         SpringApplication.run(MyApp.class, args);
 *     }
 * }
 * }</pre>
 *
 * @see AgentAuth
 * @see AgentCapability
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface AgentManifest {

    /**
     * Human-readable service name (e.g., {@code "Acme Email"}).
     */
    String name();

    /**
     * 2-3 sentence description of the service, written for an LLM to understand
     * what this service does and when to use it.
     */
    String description();

    /**
     * Base URL for all API calls. Capability endpoints are relative to this URL.
     * Example: {@code "https://api.example.com"}
     */
    String baseUrl();

    /**
     * Authentication configuration. Defaults to {@code type = "none"} (public API).
     */
    AgentAuth auth() default @AgentAuth(type = "none");
}
