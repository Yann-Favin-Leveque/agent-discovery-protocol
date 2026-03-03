"""Agent Discovery Protocol SDK for FastAPI.

Serve a /.well-known/agent manifest so AI agents can discover your API at runtime.
"""

from agent_well_known.manifest import AgentManifest, Capability

__all__ = ["AgentManifest", "Capability"]
__version__ = "1.2.0"
