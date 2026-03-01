package dev.agentdiscovery.wellknown.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Represents the authentication configuration in the Agent Discovery Protocol manifest.
 *
 * <p>Supports three authentication types:</p>
 * <ul>
 *   <li>{@code "none"} — public API, no authentication required</li>
 *   <li>{@code "api_key"} — API key passed via a header</li>
 *   <li>{@code "oauth2"} — OAuth 2.0 authorization code flow</li>
 * </ul>
 *
 * <p>Fields that are not relevant to the chosen type are omitted from the
 * serialized JSON output via {@link JsonInclude}.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthDefinition {

    private final String type;
    private final String header;
    private final String prefix;
    private final String setupUrl;
    private final String authorizationUrl;
    private final String tokenUrl;
    private final List<String> scopes;

    private AuthDefinition(Builder builder) {
        this.type = builder.type;
        this.header = builder.header;
        this.prefix = builder.prefix;
        this.setupUrl = builder.setupUrl;
        this.authorizationUrl = builder.authorizationUrl;
        this.tokenUrl = builder.tokenUrl;
        this.scopes = builder.scopes;
    }

    @JsonProperty("type")
    public String getType() {
        return type;
    }

    @JsonProperty("header")
    public String getHeader() {
        return header;
    }

    @JsonProperty("prefix")
    public String getPrefix() {
        return prefix;
    }

    @JsonProperty("setup_url")
    public String getSetupUrl() {
        return setupUrl;
    }

    @JsonProperty("authorization_url")
    public String getAuthorizationUrl() {
        return authorizationUrl;
    }

    @JsonProperty("token_url")
    public String getTokenUrl() {
        return tokenUrl;
    }

    @JsonProperty("scopes")
    public List<String> getScopes() {
        return scopes;
    }

    /**
     * Creates a new builder for constructing an {@link AuthDefinition}.
     */
    public static Builder builder(String type) {
        return new Builder(type);
    }

    /**
     * Creates an {@link AuthDefinition} representing no authentication.
     */
    public static AuthDefinition none() {
        return builder("none").build();
    }

    public static final class Builder {
        private final String type;
        private String header;
        private String prefix;
        private String setupUrl;
        private String authorizationUrl;
        private String tokenUrl;
        private List<String> scopes;

        private Builder(String type) {
            this.type = type;
        }

        public Builder header(String header) {
            this.header = header;
            return this;
        }

        public Builder prefix(String prefix) {
            this.prefix = prefix;
            return this;
        }

        public Builder setupUrl(String setupUrl) {
            this.setupUrl = setupUrl;
            return this;
        }

        public Builder authorizationUrl(String authorizationUrl) {
            this.authorizationUrl = authorizationUrl;
            return this;
        }

        public Builder tokenUrl(String tokenUrl) {
            this.tokenUrl = tokenUrl;
            return this;
        }

        public Builder scopes(List<String> scopes) {
            this.scopes = scopes;
            return this;
        }

        public AuthDefinition build() {
            return new AuthDefinition(this);
        }
    }
}
