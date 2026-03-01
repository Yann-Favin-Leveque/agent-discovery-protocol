package dev.agentdiscovery.wellknown;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration properties for the Agent Discovery Protocol manifest.
 *
 * <p>Provides an alternative to annotation-based configuration. Instead of
 * using {@link AgentManifest} and {@link AgentCapability} annotations, you
 * can configure the manifest entirely via {@code application.yml} or
 * {@code application.properties}.</p>
 *
 * <p>Example {@code application.yml}:</p>
 * <pre>{@code
 * agent:
 *   manifest:
 *     name: My API
 *     description: What my API does in 2-3 sentences.
 *     base-url: https://api.example.com
 *     auth:
 *       type: api_key
 *       header: Authorization
 *       prefix: Bearer
 *       setup-url: https://example.com/api-keys
 *     capabilities:
 *       - name: send_email
 *         description: Send an email to one or more recipients.
 *         endpoint: /api/emails
 *         method: POST
 *         parameters:
 *           - name: to
 *             type: string
 *             required: true
 *             description: Recipient email address
 *             example: alice@example.com
 * }</pre>
 *
 * <p>When both annotations and properties are present, annotation-based
 * configuration takes precedence for the manifest metadata, while capabilities
 * from both sources are merged.</p>
 */
@ConfigurationProperties(prefix = "agent.manifest")
public class AgentManifestProperties {

    /**
     * Human-readable service name.
     */
    private String name;

    /**
     * 2-3 sentence description of the service.
     */
    private String description;

    /**
     * Base URL for all API calls.
     */
    private String baseUrl;

    /**
     * Authentication configuration.
     */
    private AuthProperties auth = new AuthProperties();

    /**
     * List of capabilities defined via properties.
     */
    private List<CapabilityProperties> capabilities = new ArrayList<>();

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public AuthProperties getAuth() {
        return auth;
    }

    public void setAuth(AuthProperties auth) {
        this.auth = auth;
    }

    public List<CapabilityProperties> getCapabilities() {
        return capabilities;
    }

    public void setCapabilities(List<CapabilityProperties> capabilities) {
        this.capabilities = capabilities;
    }

    /**
     * Returns {@code true} if any manifest properties are configured.
     */
    public boolean isConfigured() {
        return name != null && !name.isBlank();
    }

    /**
     * Authentication configuration properties.
     */
    public static class AuthProperties {

        private String type = "none";
        private String header;
        private String prefix;
        private String setupUrl;
        private String authorizationUrl;
        private String tokenUrl;
        private List<String> scopes = new ArrayList<>();

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getHeader() {
            return header;
        }

        public void setHeader(String header) {
            this.header = header;
        }

        public String getPrefix() {
            return prefix;
        }

        public void setPrefix(String prefix) {
            this.prefix = prefix;
        }

        public String getSetupUrl() {
            return setupUrl;
        }

        public void setSetupUrl(String setupUrl) {
            this.setupUrl = setupUrl;
        }

        public String getAuthorizationUrl() {
            return authorizationUrl;
        }

        public void setAuthorizationUrl(String authorizationUrl) {
            this.authorizationUrl = authorizationUrl;
        }

        public String getTokenUrl() {
            return tokenUrl;
        }

        public void setTokenUrl(String tokenUrl) {
            this.tokenUrl = tokenUrl;
        }

        public List<String> getScopes() {
            return scopes;
        }

        public void setScopes(List<String> scopes) {
            this.scopes = scopes;
        }
    }

    /**
     * Capability configuration properties.
     */
    public static class CapabilityProperties {

        private String name;
        private String description;
        private String endpoint;
        private String method;
        private List<ParameterProperties> parameters = new ArrayList<>();
        private List<String> authScopes = new ArrayList<>();
        private int requestsPerMinute = -1;
        private int dailyLimit = -1;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public String getMethod() {
            return method;
        }

        public void setMethod(String method) {
            this.method = method;
        }

        public List<ParameterProperties> getParameters() {
            return parameters;
        }

        public void setParameters(List<ParameterProperties> parameters) {
            this.parameters = parameters;
        }

        public List<String> getAuthScopes() {
            return authScopes;
        }

        public void setAuthScopes(List<String> authScopes) {
            this.authScopes = authScopes;
        }

        public int getRequestsPerMinute() {
            return requestsPerMinute;
        }

        public void setRequestsPerMinute(int requestsPerMinute) {
            this.requestsPerMinute = requestsPerMinute;
        }

        public int getDailyLimit() {
            return dailyLimit;
        }

        public void setDailyLimit(int dailyLimit) {
            this.dailyLimit = dailyLimit;
        }
    }

    /**
     * Parameter configuration properties.
     */
    public static class ParameterProperties {

        private String name;
        private String type;
        private boolean required;
        private String description;
        private String example;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public boolean isRequired() {
            return required;
        }

        public void setRequired(boolean required) {
            this.required = required;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getExample() {
            return example;
        }

        public void setExample(String example) {
            this.example = example;
        }
    }
}
