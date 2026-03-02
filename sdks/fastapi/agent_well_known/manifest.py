"""Core models and mounting logic for the Agent Discovery Protocol."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


# ---------------------------------------------------------------------------
# Capability
# ---------------------------------------------------------------------------

class Capability(BaseModel):
    """A single capability exposed by a service.

    Each capability maps to one API endpoint.  The SDK auto-generates
    ``detail_url`` (used in the top-level manifest) and ``request_example``
    (used in the detail response) when they are not provided explicitly.
    """

    name: str = Field(
        ...,
        description="Machine-readable identifier (snake_case).",
    )
    description: str = Field(
        ...,
        description="1-2 sentences for LLM understanding.",
    )
    endpoint: str = Field(
        ...,
        description="API path relative to base_url (e.g. '/v1/emails/send').",
    )
    method: str = Field(
        ...,
        description="HTTP method: GET, POST, PUT, PATCH, or DELETE.",
    )
    parameters: List[Dict[str, Any]] = Field(
        ...,
        description=(
            "Parameter definitions.  Each dict must contain: name (str), "
            "type (str), required (bool), description (str), example (any)."
        ),
    )
    request_example: Optional[Dict[str, Any]] = Field(
        None,
        description="Complete example request.  Auto-generated if omitted.",
    )
    response_example: Optional[Dict[str, Any]] = Field(
        None,
        description="Complete example response.",
    )
    auth_scopes: Optional[List[str]] = Field(
        None,
        description="Auth scopes required for this capability.",
    )
    rate_limits: Optional[Dict[str, Any]] = Field(
        None,
        description="Rate-limiting info (e.g. requests_per_minute, daily_limit).",
    )
    resource_group: Optional[str] = Field(
        None,
        description="Logical resource group for organizing related capabilities (e.g. 'messages', 'users').",
    )

    # -- validators ---------------------------------------------------------

    @validator("method")
    def _validate_method(cls, v: str) -> str:  # noqa: N805
        allowed = {"GET", "POST", "PUT", "PATCH", "DELETE"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(
                f"method must be one of {sorted(allowed)}, got '{v}'"
            )
        return upper

    @validator("parameters", each_item=True)
    def _validate_parameter(cls, v: Dict[str, Any]) -> Dict[str, Any]:  # noqa: N805
        required_keys = {"name", "type", "required", "description", "example"}
        missing = required_keys - set(v.keys())
        if missing:
            raise ValueError(
                f"Each parameter must contain {sorted(required_keys)}; "
                f"missing: {sorted(missing)}"
            )
        return v

    class Config:
        # Allow arbitrary dict values inside parameters / examples.
        arbitrary_types_allowed = True

    # -- helpers ------------------------------------------------------------

    def _build_request_example(
        self, base_url: str, auth: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate a ``request_example`` from capability fields."""
        headers: Dict[str, str] = {"Content-Type": "application/json"}

        auth_type = auth.get("type", "none")
        if auth_type == "oauth2":
            headers["Authorization"] = "Bearer {access_token}"
        elif auth_type == "api_key":
            header_name = auth.get("header", "Authorization")
            prefix = auth.get("prefix", "")
            placeholder = "{api_key}"
            headers[header_name] = (
                f"{prefix} {placeholder}" if prefix else placeholder
            )

        body: Dict[str, Any] = {}
        for param in self.parameters:
            if param.get("required", False):
                body[param["name"]] = param.get("example")

        example: Dict[str, Any] = {
            "method": self.method,
            "url": f"{base_url.rstrip('/')}{self.endpoint}",
            "headers": headers,
        }

        if self.method in ("POST", "PUT", "PATCH"):
            example["body"] = body

        return example

    def _detail_url(self) -> str:
        return f"/.well-known/agent/capabilities/{self.name}"

    def to_manifest_entry(self) -> Dict[str, Any]:
        """Return the lightweight summary used in the top-level manifest."""
        entry: Dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "detail_url": self._detail_url(),
        }
        if self.resource_group is not None:
            entry["resource_group"] = self.resource_group
        return entry

    def to_detail(self, base_url: str, auth: Dict[str, Any]) -> Dict[str, Any]:
        """Return the full detail payload for the capability detail endpoint."""
        request_ex = self.request_example or self._build_request_example(
            base_url, auth
        )

        detail: Dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "endpoint": self.endpoint,
            "method": self.method,
            "parameters": self.parameters,
            "request_example": request_ex,
        }

        if self.response_example is not None:
            detail["response_example"] = self.response_example

        if self.auth_scopes is not None:
            detail["auth_scopes"] = self.auth_scopes

        if self.rate_limits is not None:
            detail["rate_limits"] = self.rate_limits

        if self.resource_group is not None:
            detail["resource_group"] = self.resource_group

        return detail


# ---------------------------------------------------------------------------
# AgentManifest
# ---------------------------------------------------------------------------

class AgentManifest(BaseModel):
    """Top-level manifest for the Agent Discovery Protocol (spec v1.0).

    Usage::

        manifest = AgentManifest(
            name="My API",
            description="What my API does.",
            base_url="https://api.example.com",
            auth={"type": "api_key", "header": "Authorization",
                  "prefix": "Bearer",
                  "setup_url": "https://example.com/api-keys"},
            capabilities=[...],
        )

        app = FastAPI()
        manifest.mount(app)
    """

    name: str = Field(..., description="Human-readable service name.")
    description: str = Field(
        ...,
        description=(
            "2-3 sentences describing the service, written for an LLM to "
            "understand what this service does and when to use it."
        ),
    )
    base_url: str = Field(
        ...,
        description="Base URL for all API calls.",
    )
    auth: Dict[str, Any] = Field(
        ...,
        description="Authentication configuration (oauth2 | api_key | none).",
    )
    pricing: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional pricing information.",
    )
    capabilities: List[Capability] = Field(
        ...,
        description="List of capabilities exposed by this service.",
        min_items=1,
    )

    # -- validators ---------------------------------------------------------

    @validator("auth")
    def _validate_auth(cls, v: Dict[str, Any]) -> Dict[str, Any]:  # noqa: N805
        auth_type = v.get("type")
        if auth_type is None:
            raise ValueError("auth must contain a 'type' field")

        valid_types = {"oauth2", "api_key", "none"}
        if auth_type not in valid_types:
            raise ValueError(
                f"auth.type must be one of {sorted(valid_types)}, "
                f"got '{auth_type}'"
            )

        if auth_type == "oauth2":
            for key in ("authorization_url", "token_url"):
                if key not in v:
                    raise ValueError(
                        f"auth.type='oauth2' requires '{key}'"
                    )

        if auth_type == "api_key":
            if "header" not in v:
                raise ValueError("auth.type='api_key' requires 'header'")

        return v

    @validator("capabilities")
    def _unique_capability_names(cls, v: List[Capability]) -> List[Capability]:  # noqa: N805
        seen: set = set()
        for cap in v:
            if cap.name in seen:
                raise ValueError(
                    f"Duplicate capability name: '{cap.name}'"
                )
            seen.add(cap.name)
        return v

    class Config:
        arbitrary_types_allowed = True

    # -- public API ---------------------------------------------------------

    def to_manifest_dict(self) -> Dict[str, Any]:
        """Build the JSON-serialisable manifest for ``/.well-known/agent``."""
        manifest: Dict[str, Any] = {
            "spec_version": "1.0",
            "name": self.name,
            "description": self.description,
            "base_url": self.base_url,
            "auth": self.auth,
        }

        if self.pricing is not None:
            manifest["pricing"] = self.pricing

        manifest["capabilities"] = [
            cap.to_manifest_entry() for cap in self.capabilities
        ]

        return manifest

    def mount(self, app: Any) -> None:
        """Register Agent Discovery Protocol routes on a FastAPI application.

        This adds two endpoints:

        - ``GET /.well-known/agent`` -- returns the top-level manifest.
        - ``GET /.well-known/agent/capabilities/{name}`` -- returns the
          full detail for a single capability.

        Both endpoints include CORS and caching headers as recommended by
        the spec.

        Parameters
        ----------
        app:
            A ``FastAPI`` (or ``APIRouter``) instance.
        """
        from fastapi import HTTPException
        from fastapi.responses import JSONResponse

        # Build payloads once at mount time so we are not re-serialising
        # on every request.
        manifest_payload = self.to_manifest_dict()

        capability_details: Dict[str, Dict[str, Any]] = {}
        for cap in self.capabilities:
            capability_details[cap.name] = cap.to_detail(
                self.base_url, self.auth
            )

        headers = {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
        }

        @app.get(
            "/.well-known/agent",
            summary="Agent Discovery Protocol manifest",
            description="Returns the service manifest following the Agent Discovery Protocol spec v1.0.",
            tags=["Agent Discovery"],
            include_in_schema=False,
        )
        def _agent_manifest() -> JSONResponse:
            return JSONResponse(
                content=manifest_payload,
                headers=headers,
            )

        @app.get(
            "/.well-known/agent/capabilities/{capability_name}",
            summary="Capability detail",
            description="Returns the full detail for a single capability.",
            tags=["Agent Discovery"],
            include_in_schema=False,
        )
        def _capability_detail(capability_name: str) -> JSONResponse:
            detail = capability_details.get(capability_name)
            if detail is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Capability '{capability_name}' not found.",
                )
            return JSONResponse(
                content=detail,
                headers=headers,
            )
