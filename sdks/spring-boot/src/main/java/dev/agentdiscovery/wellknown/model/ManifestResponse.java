package dev.agentdiscovery.wellknown.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * The top-level manifest response returned by the {@code /.well-known/agent} endpoint.
 *
 * <p>Conforms to the Manifest Format in the Agent Discovery Protocol spec v1.0.
 * Contains the service identity, authentication configuration, and a list of
 * capability summaries that agents can drill down into.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ManifestResponse {

    private final String specVersion;
    private final String name;
    private final String description;
    private final String baseUrl;
    private final AuthDefinition auth;
    private final List<CapabilitySummary> capabilities;

    private ManifestResponse(Builder builder) {
        this.specVersion = builder.specVersion;
        this.name = builder.name;
        this.description = builder.description;
        this.baseUrl = builder.baseUrl;
        this.auth = builder.auth;
        this.capabilities = builder.capabilities;
    }

    @JsonProperty("spec_version")
    public String getSpecVersion() {
        return specVersion;
    }

    @JsonProperty("name")
    public String getName() {
        return name;
    }

    @JsonProperty("description")
    public String getDescription() {
        return description;
    }

    @JsonProperty("base_url")
    public String getBaseUrl() {
        return baseUrl;
    }

    @JsonProperty("auth")
    public AuthDefinition getAuth() {
        return auth;
    }

    @JsonProperty("capabilities")
    public List<CapabilitySummary> getCapabilities() {
        return capabilities;
    }

    /**
     * Creates a new builder for constructing a {@link ManifestResponse}.
     */
    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private String specVersion = "1.0";
        private String name;
        private String description;
        private String baseUrl;
        private AuthDefinition auth;
        private List<CapabilitySummary> capabilities;

        private Builder() {}

        public Builder specVersion(String specVersion) {
            this.specVersion = specVersion;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder auth(AuthDefinition auth) {
            this.auth = auth;
            return this;
        }

        public Builder capabilities(List<CapabilitySummary> capabilities) {
            this.capabilities = capabilities;
            return this;
        }

        public ManifestResponse build() {
            return new ManifestResponse(this);
        }
    }
}
