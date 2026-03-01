package dev.agentdiscovery.wellknown.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Full detail response for a single capability, returned by the
 * {@code /.well-known/agent/capabilities/{name}} endpoint.
 *
 * <p>Contains everything an agent needs to make the API call: the endpoint,
 * HTTP method, parameter definitions, request/response examples, required
 * auth scopes, and rate limits.</p>
 *
 * <p>Conforms to the Capability Detail Format in the Agent Discovery Protocol
 * spec v1.0.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CapabilityResponse {

    private final String name;
    private final String description;
    private final String endpoint;
    private final String method;
    private final List<ParameterDefinition> parameters;
    private final Map<String, Object> requestExample;
    private final Map<String, Object> responseExample;
    private final List<String> authScopes;
    private final Map<String, Object> rateLimits;

    private CapabilityResponse(Builder builder) {
        this.name = builder.name;
        this.description = builder.description;
        this.endpoint = builder.endpoint;
        this.method = builder.method;
        this.parameters = builder.parameters;
        this.requestExample = builder.requestExample;
        this.responseExample = builder.responseExample;
        this.authScopes = builder.authScopes;
        this.rateLimits = builder.rateLimits;
    }

    @JsonProperty("name")
    public String getName() {
        return name;
    }

    @JsonProperty("description")
    public String getDescription() {
        return description;
    }

    @JsonProperty("endpoint")
    public String getEndpoint() {
        return endpoint;
    }

    @JsonProperty("method")
    public String getMethod() {
        return method;
    }

    @JsonProperty("parameters")
    public List<ParameterDefinition> getParameters() {
        return parameters;
    }

    @JsonProperty("request_example")
    public Map<String, Object> getRequestExample() {
        return requestExample;
    }

    @JsonProperty("response_example")
    public Map<String, Object> getResponseExample() {
        return responseExample;
    }

    @JsonProperty("auth_scopes")
    public List<String> getAuthScopes() {
        return authScopes;
    }

    @JsonProperty("rate_limits")
    public Map<String, Object> getRateLimits() {
        return rateLimits;
    }

    /**
     * Creates a new builder for constructing a {@link CapabilityResponse}.
     */
    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private String name;
        private String description;
        private String endpoint;
        private String method;
        private List<ParameterDefinition> parameters;
        private Map<String, Object> requestExample;
        private Map<String, Object> responseExample;
        private List<String> authScopes;
        private Map<String, Object> rateLimits;

        private Builder() {}

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder endpoint(String endpoint) {
            this.endpoint = endpoint;
            return this;
        }

        public Builder method(String method) {
            this.method = method;
            return this;
        }

        public Builder parameters(List<ParameterDefinition> parameters) {
            this.parameters = parameters;
            return this;
        }

        public Builder requestExample(Map<String, Object> requestExample) {
            this.requestExample = requestExample;
            return this;
        }

        public Builder responseExample(Map<String, Object> responseExample) {
            this.responseExample = responseExample;
            return this;
        }

        public Builder authScopes(List<String> authScopes) {
            this.authScopes = authScopes;
            return this;
        }

        public Builder rateLimits(Map<String, Object> rateLimits) {
            this.rateLimits = rateLimits;
            return this;
        }

        public CapabilityResponse build() {
            return new CapabilityResponse(this);
        }
    }
}
