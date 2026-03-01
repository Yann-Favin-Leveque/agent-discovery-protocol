package dev.agentdiscovery.wellknown;

import dev.agentdiscovery.wellknown.model.AuthDefinition;
import dev.agentdiscovery.wellknown.model.CapabilityResponse;
import dev.agentdiscovery.wellknown.model.CapabilitySummary;
import dev.agentdiscovery.wellknown.model.ManifestResponse;
import dev.agentdiscovery.wellknown.model.ParameterDefinition;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * REST controller that serves the Agent Discovery Protocol endpoints.
 *
 * <p>Exposes two endpoints:</p>
 * <ul>
 *   <li>{@code GET /.well-known/agent} — Returns the manifest with service
 *       metadata and capability summaries.</li>
 *   <li>{@code GET /.well-known/agent/capabilities/{name}} — Returns the
 *       full detail for a specific capability.</li>
 * </ul>
 *
 * <p>Both endpoints set CORS headers ({@code Access-Control-Allow-Origin: *}),
 * cache control ({@code public, max-age=3600}), and content type
 * ({@code application/json}) as required by the spec.</p>
 *
 * <p>This controller is not meant to be instantiated directly. It is created
 * by {@link AgentManifestAutoConfiguration} which collects metadata from
 * annotations and/or properties.</p>
 */
@RestController
public class AgentManifestController {

    private static final String WELL_KNOWN_PATH = "/.well-known/agent";
    private static final String CAPABILITY_DETAIL_PATH = "/.well-known/agent/capabilities/{name}";
    private static final CacheControl CACHE_CONTROL = CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic();

    private final ManifestResponse manifest;
    private final Map<String, CapabilityResponse> capabilityDetails;

    /**
     * Creates the controller with pre-built manifest and capability details.
     *
     * @param manifest          the manifest response
     * @param capabilityDetails map of capability name to its full detail response
     */
    public AgentManifestController(ManifestResponse manifest,
                                   Map<String, CapabilityResponse> capabilityDetails) {
        this.manifest = manifest;
        this.capabilityDetails = new ConcurrentHashMap<>(capabilityDetails);
    }

    /**
     * Returns the Agent Discovery Protocol manifest.
     *
     * <p>Response includes:</p>
     * <ul>
     *   <li>{@code spec_version}: always {@code "1.0"}</li>
     *   <li>{@code name}, {@code description}, {@code base_url}: service identity</li>
     *   <li>{@code auth}: authentication configuration</li>
     *   <li>{@code capabilities}: list of capability summaries with drill-down URLs</li>
     * </ul>
     */
    @GetMapping(value = WELL_KNOWN_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ManifestResponse> getManifest() {
        return ResponseEntity.ok()
                .cacheControl(CACHE_CONTROL)
                .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(manifest);
    }

    /**
     * Returns the full detail for a specific capability.
     *
     * <p>If the capability name is not found, returns HTTP 404 with an error body.</p>
     *
     * @param name the capability name (snake_case)
     * @return the capability detail or 404
     */
    @GetMapping(value = CAPABILITY_DETAIL_PATH, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getCapabilityDetail(@PathVariable("name") String name) {
        CapabilityResponse detail = capabilityDetails.get(name);

        if (detail == null) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("success", false);
            error.put("error", "Capability not found: " + name);
            return ResponseEntity.status(404)
                    .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(error);
        }

        return ResponseEntity.ok()
                .cacheControl(CACHE_CONTROL)
                .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(detail);
    }

    /**
     * Returns the current manifest (for programmatic access from other beans).
     */
    public ManifestResponse getManifestResponse() {
        return manifest;
    }

    /**
     * Returns the capability details map (for programmatic access from other beans).
     */
    public Map<String, CapabilityResponse> getCapabilityDetailsMap() {
        return Map.copyOf(capabilityDetails);
    }
}
