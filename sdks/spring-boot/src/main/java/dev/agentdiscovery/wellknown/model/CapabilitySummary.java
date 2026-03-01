package dev.agentdiscovery.wellknown.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Lightweight summary of a capability, as it appears in the manifest's
 * {@code capabilities} array.
 *
 * <p>Contains just enough information for an agent to decide whether to
 * drill down into the full capability detail. This supports the lazy
 * drill-down pattern: agents only fetch what they need.</p>
 */
public class CapabilitySummary {

    private final String name;
    private final String description;
    private final String detailUrl;

    public CapabilitySummary(String name, String description, String detailUrl) {
        this.name = name;
        this.description = description;
        this.detailUrl = detailUrl;
    }

    @JsonProperty("name")
    public String getName() {
        return name;
    }

    @JsonProperty("description")
    public String getDescription() {
        return description;
    }

    @JsonProperty("detail_url")
    public String getDetailUrl() {
        return detailUrl;
    }
}
