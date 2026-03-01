package dev.agentdiscovery.wellknown;

import dev.agentdiscovery.wellknown.model.AuthDefinition;
import dev.agentdiscovery.wellknown.model.CapabilityResponse;
import dev.agentdiscovery.wellknown.model.CapabilitySummary;
import dev.agentdiscovery.wellknown.model.ManifestResponse;
import dev.agentdiscovery.wellknown.model.ParameterDefinition;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Spring Boot auto-configuration for the Agent Discovery Protocol.
 *
 * <p>This configuration is activated automatically when the application is
 * a web application. It performs two tasks:</p>
 * <ol>
 *   <li>Scans all Spring-managed beans for {@link AgentManifest} and
 *       {@link AgentCapability} annotations.</li>
 *   <li>Creates an {@link AgentManifestController} bean that serves the
 *       {@code /.well-known/agent} endpoint and capability detail endpoints.</li>
 * </ol>
 *
 * <p>Configuration can come from annotations, {@code application.yml} properties
 * (via {@link AgentManifestProperties}), or a combination of both. When both
 * sources provide manifest metadata, annotation values take precedence.
 * Capabilities from both sources are merged.</p>
 *
 * @see AgentManifest
 * @see AgentCapability
 * @see AgentManifestProperties
 */
@AutoConfiguration
@ConditionalOnWebApplication
@EnableConfigurationProperties(AgentManifestProperties.class)
public class AgentManifestAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(AgentManifestAutoConfiguration.class);

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private AgentManifestProperties properties;

    @Bean
    public AgentManifestController agentManifestController() {
        // 1. Resolve manifest metadata (annotations take precedence over properties)
        String manifestName = null;
        String manifestDescription = null;
        String manifestBaseUrl = null;
        AgentAuth manifestAuth = null;

        // Scan for @AgentManifest on any bean
        String[] beanNames = applicationContext.getBeanDefinitionNames();
        for (String beanName : beanNames) {
            try {
                Class<?> beanType = applicationContext.getType(beanName);
                if (beanType != null && beanType.isAnnotationPresent(AgentManifest.class)) {
                    AgentManifest annotation = beanType.getAnnotation(AgentManifest.class);
                    manifestName = annotation.name();
                    manifestDescription = annotation.description();
                    manifestBaseUrl = annotation.baseUrl();
                    manifestAuth = annotation.auth();
                    log.info("Agent Discovery Protocol: found @AgentManifest on {}", beanType.getSimpleName());
                    break;
                }
            } catch (Exception e) {
                // Some beans may not have a resolvable type; skip them
                log.trace("Skipping bean '{}' during @AgentManifest scan: {}", beanName, e.getMessage());
            }
        }

        // Fall back to properties if no annotation found
        if (manifestName == null && properties.isConfigured()) {
            manifestName = properties.getName();
            manifestDescription = properties.getDescription();
            manifestBaseUrl = properties.getBaseUrl();
            log.info("Agent Discovery Protocol: using application properties configuration");
        }

        if (manifestName == null) {
            log.warn("Agent Discovery Protocol: no @AgentManifest annotation or agent.manifest properties found. "
                    + "The /.well-known/agent endpoint will return a minimal manifest.");
            manifestName = "Unconfigured Service";
            manifestDescription = "This service has not configured its Agent Discovery manifest.";
            manifestBaseUrl = "";
        }

        // 2. Build the auth definition
        AuthDefinition authDefinition = buildAuthDefinition(manifestAuth, properties.getAuth());

        // 3. Collect capabilities from annotations
        Map<String, CapabilityResponse> capabilityDetails = new LinkedHashMap<>();
        List<CapabilitySummary> capabilitySummaries = new ArrayList<>();

        collectAnnotationCapabilities(beanNames, manifestBaseUrl, authDefinition,
                capabilityDetails, capabilitySummaries);

        // 4. Collect capabilities from properties (merge, don't overwrite)
        collectPropertiesCapabilities(properties, manifestBaseUrl, authDefinition,
                capabilityDetails, capabilitySummaries);

        log.info("Agent Discovery Protocol: registered {} capabilities for '{}'",
                capabilitySummaries.size(), manifestName);

        // 5. Build the manifest
        ManifestResponse manifest = ManifestResponse.builder()
                .specVersion("1.0")
                .name(manifestName)
                .description(manifestDescription)
                .baseUrl(manifestBaseUrl)
                .auth(authDefinition)
                .capabilities(capabilitySummaries)
                .build();

        return new AgentManifestController(manifest, capabilityDetails);
    }

    /**
     * Scans all beans for methods annotated with {@link AgentCapability} and
     * collects them into the provided maps/lists.
     */
    private void collectAnnotationCapabilities(String[] beanNames, String baseUrl,
                                                AuthDefinition authDefinition,
                                                Map<String, CapabilityResponse> details,
                                                List<CapabilitySummary> summaries) {
        for (String beanName : beanNames) {
            try {
                Class<?> beanType = applicationContext.getType(beanName);
                if (beanType == null) continue;

                for (Method method : beanType.getDeclaredMethods()) {
                    AgentCapability[] capabilities = method.getAnnotationsByType(AgentCapability.class);
                    for (AgentCapability cap : capabilities) {
                        if (details.containsKey(cap.name())) {
                            log.warn("Agent Discovery Protocol: duplicate capability name '{}', skipping", cap.name());
                            continue;
                        }

                        CapabilityResponse detail = buildCapabilityResponse(cap, baseUrl, authDefinition);
                        details.put(cap.name(), detail);

                        String detailUrl = "/.well-known/agent/capabilities/" + cap.name();
                        summaries.add(new CapabilitySummary(cap.name(), cap.description(), detailUrl));

                        log.debug("Agent Discovery Protocol: registered capability '{}' -> {} {}",
                                cap.name(), cap.method(), cap.endpoint());
                    }
                }
            } catch (Exception e) {
                log.trace("Skipping bean '{}' during @AgentCapability scan: {}", beanName, e.getMessage());
            }
        }
    }

    /**
     * Collects capabilities defined in {@link AgentManifestProperties} and merges
     * them into the provided maps/lists. Capabilities already defined by
     * annotations are not overwritten.
     */
    private void collectPropertiesCapabilities(AgentManifestProperties props, String baseUrl,
                                                AuthDefinition authDefinition,
                                                Map<String, CapabilityResponse> details,
                                                List<CapabilitySummary> summaries) {
        if (props.getCapabilities() == null) return;

        for (AgentManifestProperties.CapabilityProperties capProp : props.getCapabilities()) {
            if (capProp.getName() == null || capProp.getName().isBlank()) continue;
            if (details.containsKey(capProp.getName())) {
                log.debug("Agent Discovery Protocol: capability '{}' already defined by annotation, skipping property definition",
                        capProp.getName());
                continue;
            }

            CapabilityResponse detail = buildCapabilityResponseFromProperties(capProp, baseUrl, authDefinition);
            details.put(capProp.getName(), detail);

            String detailUrl = "/.well-known/agent/capabilities/" + capProp.getName();
            summaries.add(new CapabilitySummary(capProp.getName(), capProp.getDescription(), detailUrl));

            log.debug("Agent Discovery Protocol: registered capability '{}' from properties -> {} {}",
                    capProp.getName(), capProp.getMethod(), capProp.getEndpoint());
        }
    }

    /**
     * Builds an {@link AuthDefinition} from the annotation and/or properties.
     * Annotation values take precedence.
     */
    private AuthDefinition buildAuthDefinition(AgentAuth annotation,
                                                AgentManifestProperties.AuthProperties props) {
        String type;
        if (annotation != null) {
            type = annotation.type();
        } else if (props != null) {
            type = props.getType();
        } else {
            return AuthDefinition.none();
        }

        AuthDefinition.Builder builder = AuthDefinition.builder(type);

        switch (type) {
            case "api_key" -> {
                String header = resolveString(
                        annotation != null ? annotation.header() : null,
                        props != null ? props.getHeader() : null);
                String prefix = resolveString(
                        annotation != null ? annotation.prefix() : null,
                        props != null ? props.getPrefix() : null);
                String setupUrl = resolveString(
                        annotation != null ? annotation.setupUrl() : null,
                        props != null ? props.getSetupUrl() : null);
                if (header != null) builder.header(header);
                if (prefix != null) builder.prefix(prefix);
                if (setupUrl != null) builder.setupUrl(setupUrl);
            }
            case "oauth2" -> {
                String authorizationUrl = resolveString(
                        annotation != null ? annotation.authorizationUrl() : null,
                        props != null ? props.getAuthorizationUrl() : null);
                String tokenUrl = resolveString(
                        annotation != null ? annotation.tokenUrl() : null,
                        props != null ? props.getTokenUrl() : null);
                if (authorizationUrl != null) builder.authorizationUrl(authorizationUrl);
                if (tokenUrl != null) builder.tokenUrl(tokenUrl);

                List<String> scopes;
                if (annotation != null && annotation.scopes().length > 0) {
                    scopes = Arrays.asList(annotation.scopes());
                } else if (props != null && props.getScopes() != null && !props.getScopes().isEmpty()) {
                    scopes = props.getScopes();
                } else {
                    scopes = null;
                }
                if (scopes != null) builder.scopes(scopes);
            }
            // "none" or unknown — no extra fields needed
        }

        return builder.build();
    }

    /**
     * Builds a {@link CapabilityResponse} from an {@link AgentCapability} annotation.
     */
    private CapabilityResponse buildCapabilityResponse(AgentCapability cap, String baseUrl,
                                                        AuthDefinition authDefinition) {
        List<ParameterDefinition> parameters = new ArrayList<>();
        for (AgentParameter param : cap.parameters()) {
            Object example = param.example().isEmpty() ? null : parseExample(param.example(), param.type());
            parameters.add(new ParameterDefinition(
                    param.name(), param.type(), param.description(), param.required(), example));
        }

        // Build request example
        Map<String, Object> requestExample = buildRequestExample(
                cap.method(), baseUrl, cap.endpoint(), parameters, authDefinition);

        // Build response example placeholder
        Map<String, Object> responseExample = buildResponseExamplePlaceholder();

        // Auth scopes
        List<String> authScopes = cap.authScopes().length > 0
                ? Arrays.asList(cap.authScopes()) : null;

        // Rate limits
        Map<String, Object> rateLimits = buildRateLimits(cap.requestsPerMinute(), cap.dailyLimit());

        return CapabilityResponse.builder()
                .name(cap.name())
                .description(cap.description())
                .endpoint(cap.endpoint())
                .method(cap.method())
                .parameters(parameters)
                .requestExample(requestExample)
                .responseExample(responseExample)
                .authScopes(authScopes)
                .rateLimits(rateLimits)
                .build();
    }

    /**
     * Builds a {@link CapabilityResponse} from properties configuration.
     */
    private CapabilityResponse buildCapabilityResponseFromProperties(
            AgentManifestProperties.CapabilityProperties capProp, String baseUrl,
            AuthDefinition authDefinition) {
        List<ParameterDefinition> parameters = new ArrayList<>();
        if (capProp.getParameters() != null) {
            for (AgentManifestProperties.ParameterProperties paramProp : capProp.getParameters()) {
                Object example = paramProp.getExample() != null && !paramProp.getExample().isBlank()
                        ? parseExample(paramProp.getExample(), paramProp.getType())
                        : null;
                parameters.add(new ParameterDefinition(
                        paramProp.getName(), paramProp.getType(), paramProp.getDescription(),
                        paramProp.isRequired(), example));
            }
        }

        Map<String, Object> requestExample = buildRequestExample(
                capProp.getMethod(), baseUrl, capProp.getEndpoint(), parameters, authDefinition);
        Map<String, Object> responseExample = buildResponseExamplePlaceholder();

        List<String> authScopes = capProp.getAuthScopes() != null && !capProp.getAuthScopes().isEmpty()
                ? capProp.getAuthScopes() : null;

        Map<String, Object> rateLimits = buildRateLimits(
                capProp.getRequestsPerMinute(), capProp.getDailyLimit());

        return CapabilityResponse.builder()
                .name(capProp.getName())
                .description(capProp.getDescription())
                .endpoint(capProp.getEndpoint())
                .method(capProp.getMethod())
                .parameters(parameters)
                .requestExample(requestExample)
                .responseExample(responseExample)
                .authScopes(authScopes)
                .rateLimits(rateLimits)
                .build();
    }

    /**
     * Builds a request example from capability metadata.
     */
    private Map<String, Object> buildRequestExample(String method, String baseUrl,
                                                     String endpoint,
                                                     List<ParameterDefinition> parameters,
                                                     AuthDefinition authDefinition) {
        Map<String, Object> requestExample = new LinkedHashMap<>();
        requestExample.put("method", method);
        requestExample.put("url", baseUrl + endpoint);

        // Build headers
        Map<String, String> headers = new LinkedHashMap<>();
        if (authDefinition != null) {
            switch (authDefinition.getType()) {
                case "api_key" -> {
                    String header = authDefinition.getHeader() != null
                            ? authDefinition.getHeader() : "Authorization";
                    String prefix = authDefinition.getPrefix() != null
                            ? authDefinition.getPrefix() + " " : "";
                    headers.put(header, prefix + "{api_key}");
                }
                case "oauth2" -> headers.put("Authorization", "Bearer {access_token}");
            }
        }
        if ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)) {
            headers.put("Content-Type", "application/json");
        }
        if (!headers.isEmpty()) {
            requestExample.put("headers", headers);
        }

        // Build body from parameter examples (for POST/PUT/PATCH)
        if ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)) {
            Map<String, Object> body = new LinkedHashMap<>();
            for (ParameterDefinition param : parameters) {
                if (param.getExample() != null) {
                    body.put(param.getName(), param.getExample());
                }
            }
            if (!body.isEmpty()) {
                requestExample.put("body", body);
            }
        }

        return requestExample;
    }

    /**
     * Builds a generic response example placeholder.
     */
    private Map<String, Object> buildResponseExamplePlaceholder() {
        Map<String, Object> responseExample = new LinkedHashMap<>();
        responseExample.put("status", 200);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data", Map.of());
        responseExample.put("body", body);

        return responseExample;
    }

    /**
     * Builds rate limits map, returning {@code null} if neither limit is set.
     */
    private Map<String, Object> buildRateLimits(int requestsPerMinute, int dailyLimit) {
        if (requestsPerMinute < 0 && dailyLimit < 0) {
            return null;
        }
        Map<String, Object> rateLimits = new LinkedHashMap<>();
        if (requestsPerMinute >= 0) {
            rateLimits.put("requests_per_minute", requestsPerMinute);
        }
        if (dailyLimit >= 0) {
            rateLimits.put("daily_limit", dailyLimit);
        }
        return rateLimits;
    }

    /**
     * Attempts to parse an example string into the appropriate Java type
     * based on the parameter type hint.
     */
    private Object parseExample(String example, String type) {
        if (example == null || example.isBlank()) return null;

        try {
            return switch (type) {
                case "number" -> {
                    if (example.contains(".")) {
                        yield Double.parseDouble(example);
                    }
                    yield Long.parseLong(example);
                }
                case "boolean" -> Boolean.parseBoolean(example);
                default -> example;
            };
        } catch (NumberFormatException e) {
            return example;
        }
    }

    /**
     * Returns the first non-null, non-blank string, or {@code null} if both are empty.
     */
    private String resolveString(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) return primary;
        if (fallback != null && !fallback.isBlank()) return fallback;
        return null;
    }
}
