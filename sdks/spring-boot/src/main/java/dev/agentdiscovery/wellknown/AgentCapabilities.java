package dev.agentdiscovery.wellknown;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Container annotation for repeatable {@link AgentCapability} annotations.
 *
 * <p>This annotation is not intended to be used directly. It is the container
 * type required by {@link java.lang.annotation.Repeatable} so that multiple
 * {@code @AgentCapability} annotations can be placed on the same method.</p>
 *
 * @see AgentCapability
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface AgentCapabilities {

    /**
     * The array of {@link AgentCapability} annotations.
     */
    AgentCapability[] value();
}
