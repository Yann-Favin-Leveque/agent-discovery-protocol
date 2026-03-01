package dev.agentdiscovery.wellknown.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a single parameter definition for an agent-discoverable capability.
 *
 * <p>Each parameter describes one input that the API endpoint accepts,
 * including its name, data type, whether it is required, a human-readable
 * description, and an example value.</p>
 *
 * <p>Conforms to the Parameter Object in the Agent Discovery Protocol spec v1.0.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ParameterDefinition {

    private final String name;
    private final String type;
    private final String description;
    private final boolean required;
    private final Object example;

    public ParameterDefinition(String name, String type, String description,
                               boolean required, Object example) {
        this.name = name;
        this.type = type;
        this.description = description;
        this.required = required;
        this.example = example;
    }

    @JsonProperty("name")
    public String getName() {
        return name;
    }

    @JsonProperty("type")
    public String getType() {
        return type;
    }

    @JsonProperty("description")
    public String getDescription() {
        return description;
    }

    @JsonProperty("required")
    public boolean isRequired() {
        return required;
    }

    @JsonProperty("example")
    public Object getExample() {
        return example;
    }
}
